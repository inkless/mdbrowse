import { createReadStream, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type MarkdownIt from "markdown-it";
import mime from "mime-types";
import open from "open";
import { escapeHtml, type LayoutValues, renderLayout } from "./layout.js";
import { attachLiveReload, type LiveReloadHandle } from "./live-reload.js";
import { detectGitHubRepository } from "./plugins/git-remote.js";
import { createRendererWithHighlighting, type RenderOptions, render } from "./render.js";
import { renderTree } from "./render-tree.js";
import { buildTree } from "./tree.js";

export interface ServeOptions {
  /** Host to bind. Defaults to `localhost`. */
  host?: string;
  /** Port to bind. Defaults to `6419` (matches `go-grip` and the original `grip`). */
  port?: number;
  /** Open the rendered URL in a browser when the server starts. Default true. */
  browser?: boolean;
  /** Wrap content in the GitHub bounding box. Default true. */
  boundingBox?: boolean;
  /**
   * Enable live reload — `chokidar` watches `directory`, a websocket
   * broadcasts `"reload"` on changes, and rendered pages get a small
   * client snippet injected. Default true.
   */
  reload?: boolean;
  /**
   * Directory served at `/`. Defaults to `process.cwd()`. The Markdown file
   * given on the command line is resolved relative to this directory.
   */
  directory?: string;
  /**
   * `owner/repo` slug for resolving bare `#NNN` references in markdown.
   * If omitted, auto-detected from `git remote get-url origin` in `directory`.
   */
  repository?: string;
  /** Render options forwarded to `createRendererWithHighlighting`. */
  renderOptions?: RenderOptions;
}

/**
 * Path to the bundled `dist/assets/` directory, both in development and
 * after `tsup` build. Resolved from this module's URL because `__dirname`
 * isn't available in ESM.
 */
const ASSETS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "assets");
const STATIC_ROOT = join(ASSETS_ROOT, "static");

const MD_RE = /\.(md|markdown)$/i;

export interface ServerHandle {
  url: string;
  close(): Promise<void>;
}

/**
 * Start a local HTTP server that:
 *   - serves `/static/*` from the bundled assets directory,
 *   - renders Markdown files (`.md` / `.markdown`) on demand using a shiki-
 *     enabled renderer wrapped in the GitHub-style layout template, and
 *   - falls through to a plain static file server for everything else
 *     (images, html, css siblings, etc.) rooted at `directory`.
 *
 * Returns a handle once the server is listening. Closing the handle stops
 * the server and resolves when sockets are drained.
 */
export async function serveMarkdown(
  initialFile: string | null,
  options: ServeOptions = {},
): Promise<ServerHandle> {
  const host = options.host ?? "localhost";
  const port = options.port ?? 6419;
  const directory = resolve(options.directory ?? process.cwd());
  const boundingBox = options.boundingBox ?? true;
  const browser = options.browser ?? true;
  const reloadEnabled = options.reload ?? true;
  const repository = options.repository ?? detectGitHubRepository(directory);

  const md = await createRendererWithHighlighting({
    ...options.renderOptions,
    repository,
  });

  let live: LiveReloadHandle | null = null;
  const server = createServer((req, res) => {
    handle(req, res, directory, md, boundingBox, live).catch((err) => {
      console.error("[mdgrip] handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
      }
      res.end("Internal Server Error");
    });
  });

  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      server.off("error", fail);
      ok();
    });
  });

  if (reloadEnabled) {
    live = attachLiveReload(server, directory);
  }

  // When port=0, server.listen picks a free port — read the actual one.
  const addr = server.address();
  const actualPort = addr && typeof addr === "object" ? addr.port : port;

  let url = `http://${host}:${actualPort}/`;
  if (initialFile) {
    url += encodeURI(initialFile.replace(/^\.?\//, ""));
  } else {
    try {
      const readme = await stat(join(directory, "README.md"));
      if (readme.isFile()) url += "README.md";
    } catch {
      /* no README — open root */
    }
  }

  console.log(`🚀 Starting server: ${url}`);
  if (reloadEnabled) {
    console.log("📡 Auto-reload enabled. Files will trigger browser refresh.");
  } else {
    console.log("🔄 Auto-reload disabled. Use F5 to manually refresh.");
  }
  if (browser) {
    open(url).catch((e) => console.error("❌ Error opening browser:", e));
  }

  return {
    url,
    async close(): Promise<void> {
      if (live) await live.close();
      await closeServer(server);
    },
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((ok, fail) => {
    server.close((err) => (err ? fail(err) : ok()));
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  directory: string,
  md: MarkdownIt,
  boundingBox: boolean,
  live: LiveReloadHandle | null,
): Promise<void> {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?", 1)[0] ?? "/");

  if (urlPath.startsWith("/static/")) {
    return serveStatic(res, urlPath.slice("/static/".length));
  }

  // Resolve and ensure the requested path stays inside `directory`.
  const cleaned = urlPath.replace(/^\/+/, "");
  const filePath = resolve(directory, cleaned || ".");
  if (!isInside(filePath, directory)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  let info: ReturnType<typeof statSync>;
  try {
    info = statSync(filePath);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  if (info.isFile() && MD_RE.test(filePath)) {
    return serveMarkdownFile(res, md, filePath, boundingBox, directory, urlPath, live);
  }

  if (info.isDirectory()) {
    res.writeHead(302, { Location: `${urlPath.replace(/\/+$/, "")}/` });
    res.end();
    return;
  }

  return serveFile(res, filePath);
}

async function serveMarkdownFile(
  res: ServerResponse,
  md: MarkdownIt,
  filePath: string,
  boundingBox: boolean,
  directory: string,
  currentUrlPath: string,
  live: LiveReloadHandle | null,
): Promise<void> {
  const source = await readFile(filePath, "utf8");
  const { html, title } = render(md, source);

  let explorer = "";
  try {
    explorer = renderTree(buildTree(directory), currentUrlPath);
  } catch {
    // tree build can fail on permissions / racy fs — degrade silently
  }

  const fallbackTitle = filePath.split(/[\\/]/).pop()?.replace(MD_RE, "") ?? "";
  const values: LayoutValues = {
    Title: escapeHtml(title || fallbackTitle),
    Content: html,
    FileExplorer: explorer,
    BoundingBox: boundingBox,
  };
  let out = renderLayout(values);
  if (live) out = live.injectInto(out);

  setNoCacheHeaders(res);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(out);
}

async function serveStatic(res: ServerResponse, relPath: string): Promise<void> {
  const target = resolve(STATIC_ROOT, relPath);
  if (!isInside(target, STATIC_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }
  return serveFile(res, target);
}

async function serveFile(res: ServerResponse, target: string): Promise<void> {
  let info: ReturnType<typeof statSync>;
  try {
    info = statSync(target);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
    return;
  }

  const type = mime.lookup(extname(target)) || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type === "application/octet-stream" ? type : `${type}; charset=utf-8`,
    "Content-Length": String(info.size),
  });
  createReadStream(target).pipe(res);
}

function isInside(child: string, parent: string): boolean {
  const c = isAbsolute(child) ? child : resolve(child);
  const p = parent.endsWith("/") ? parent : `${parent}/`;
  return c === parent || c.startsWith(p);
}

function setNoCacheHeaders(res: ServerResponse): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}
