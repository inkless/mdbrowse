import { createReadStream, readdirSync, statSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type MarkdownIt from "markdown-it";
import mime from "mime-types";
import open from "open";
import { detectCodeLanguage, wrapAsFencedMarkdown } from "./code.js";
import { escapeHtml, type LayoutValues, renderLayout } from "./layout.js";
import { attachLiveReload, type LiveReloadHandle } from "./live-reload.js";
import { detectGitHubRepository } from "./plugins/git-remote.js";
import { createRendererWithHighlighting, type RenderOptions, render } from "./render.js";
import { renderTree } from "./render-tree.js";
import { buildTree, flattenTree } from "./tree.js";

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
  /**
   * Show every directory in the sidebar + `Cmd+K` search regardless of
   * name. By default, dotfiles and `tree.DEFAULT_IGNORED_DIRS`
   * (`node_modules`, `dist`, etc.) are hidden. Off by default.
   */
  all?: boolean;
  /**
   * Also list recognized source/config files (TS/JS/Python/Go/JSON/…) in
   * the sidebar + `Cmd+K` search. Code files always render when navigated
   * to directly; this flag only controls whether they show up in the
   * sidebar. Off by default — markdown-only sidebars stay uncluttered.
   */
  code?: boolean;
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
  const all = options.all ?? false;
  const code = options.code ?? false;
  const repository = options.repository ?? detectGitHubRepository(directory);

  const md = await createRendererWithHighlighting({
    ...options.renderOptions,
    repository,
  });

  let live: LiveReloadHandle | null = null;
  const server = createServer((req, res) => {
    handle(req, res, directory, md, boundingBox, live, all, code).catch((err) => {
      console.error("[mdbrowse] handler error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
      }
      res.end("Internal Server Error");
    });
  });

  await listenWithFallback(server, host, port);

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

const PORT_FALLBACK_ATTEMPTS = 10;

// Listen on `port`; if it's in use, increment by one and retry up to
// PORT_FALLBACK_ATTEMPTS times. `port: 0` means "OS picks a free port" —
// no fallback semantics apply.
async function listenWithFallback(server: Server, host: string, port: number): Promise<void> {
  if (port === 0) {
    return new Promise((ok, fail) => {
      server.once("error", fail);
      server.listen(0, host, () => {
        server.off("error", fail);
        ok();
      });
    });
  }
  for (let attempt = 0; attempt < PORT_FALLBACK_ATTEMPTS; attempt++) {
    const candidate = port + attempt;
    if (candidate > 65535) break;
    try {
      await tryListen(server, host, candidate);
      if (candidate !== port) {
        console.log(`⚠️  Port ${port} in use, falling back to ${candidate}`);
      }
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
    }
  }
  throw new Error(`mdbrowse: no free port found in ${port}-${port + PORT_FALLBACK_ATTEMPTS - 1}`);
}

function tryListen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((ok, fail) => {
    const onError = (err: Error): void => {
      server.off("listening", onListening);
      fail(err);
    };
    const onListening = (): void => {
      server.off("error", onError);
      ok();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  directory: string,
  md: MarkdownIt,
  boundingBox: boolean,
  live: LiveReloadHandle | null,
  all: boolean,
  code: boolean,
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
    return serveMarkdownFile(res, md, filePath, boundingBox, directory, urlPath, live, all, code);
  }

  if (info.isFile()) {
    // Try to render as text — either with a detected shiki language or as
    // plain text. Binary/oversized files fall through to raw streaming.
    const text = await readTextIfPossible(filePath, info.size);
    if (text !== null) {
      const lang = detectCodeLanguage(filePath) ?? "text";
      return serveCodeFile(
        res,
        md,
        filePath,
        text,
        lang,
        boundingBox,
        directory,
        urlPath,
        live,
        all,
        code,
      );
    }
    return serveFile(res, filePath);
  }

  if (info.isDirectory()) {
    // No trailing slash → redirect to canonical form so relative URLs
    // (`./foo.md`, `../bar.md`) resolve as expected.
    if (!urlPath.endsWith("/")) {
      res.writeHead(302, { Location: `${urlPath}/` });
      res.end();
      return;
    }
    // Trailing slash present. Prefer rendering the directory's
    // README.md if it exists; otherwise generate a directory listing
    // page so the user can still navigate.
    const readmePath = resolve(filePath, "README.md");
    try {
      const readmeInfo = statSync(readmePath);
      if (readmeInfo.isFile()) {
        return serveMarkdownFile(
          res,
          md,
          readmePath,
          boundingBox,
          directory,
          urlPath,
          live,
          all,
          code,
        );
      }
    } catch {
      /* no README — fall through to listing */
    }
    return serveDirectoryListing(
      res,
      md,
      filePath,
      urlPath,
      boundingBox,
      directory,
      live,
      all,
      code,
    );
  }

  return serveFile(res, filePath);
}

const TEXT_SNIFF_BYTES = 8000;
const TEXT_FILE_MAX_BYTES = 5_000_000;

/**
 * Read a file as UTF-8 if it looks like text. Returns null for binary
 * (NUL byte in the first ~8KB — git's heuristic) and for files larger
 * than `TEXT_FILE_MAX_BYTES` (avoid slurping huge logs/CSVs into the
 * highlighter).
 */
async function readTextIfPossible(filePath: string, size: number): Promise<string | null> {
  if (size > TEXT_FILE_MAX_BYTES) return null;
  const buf = await readFile(filePath);
  const sample = buf.subarray(0, Math.min(TEXT_SNIFF_BYTES, buf.length));
  if (sample.includes(0)) return null;
  return buf.toString("utf8");
}

async function serveMarkdownFile(
  res: ServerResponse,
  md: MarkdownIt,
  filePath: string,
  boundingBox: boolean,
  directory: string,
  currentUrlPath: string,
  live: LiveReloadHandle | null,
  all: boolean,
  code: boolean,
): Promise<void> {
  const source = await readFile(filePath, "utf8");
  const fallbackTitle = filePath.split(/[\\/]/).pop()?.replace(MD_RE, "") ?? "";
  return servePage(
    res,
    md,
    source,
    fallbackTitle,
    boundingBox,
    directory,
    currentUrlPath,
    live,
    source,
    all,
    code,
  );
}

async function serveCodeFile(
  res: ServerResponse,
  md: MarkdownIt,
  filePath: string,
  source: string,
  lang: string,
  boundingBox: boolean,
  directory: string,
  currentUrlPath: string,
  live: LiveReloadHandle | null,
  all: boolean,
  code: boolean,
): Promise<void> {
  const fallbackTitle = filePath.split(/[\\/]/).pop() ?? "";
  // Re-use the markdown pipeline by wrapping the file in a fenced block —
  // the existing shiki `highlight` callback turns this into a themed code
  // listing (or plaintext when `lang === "text"`). Embed the *original*
  // bytes (not the fenced wrapper) so the copy-source button hands the
  // user back what's actually on disk.
  const markdownSource = wrapAsFencedMarkdown(source, lang);
  return servePage(
    res,
    md,
    markdownSource,
    fallbackTitle,
    boundingBox,
    directory,
    currentUrlPath,
    live,
    source,
    all,
    code,
  );
}

function serveDirectoryListing(
  res: ServerResponse,
  md: MarkdownIt,
  dirPath: string,
  urlPath: string,
  boundingBox: boolean,
  directory: string,
  live: LiveReloadHandle | null,
  all: boolean,
  code: boolean,
): Promise<void> {
  const source = buildDirectoryListing(dirPath, urlPath);
  return servePage(
    res,
    md,
    source,
    urlPath,
    boundingBox,
    directory,
    urlPath,
    live,
    null,
    all,
    code,
  );
}

/**
 * Build a synthetic markdown page listing the immediate (non-hidden)
 * contents of a directory. Used when the user navigates to `/foo/` and
 * there's no `README.md` inside — gives them a clickable index instead
 * of a dead-end error page.
 */
function buildDirectoryListing(dirPath: string, urlPath: string): string {
  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return `# ${urlPath}\n\n_Cannot read directory._\n`;
  }

  const dirs: string[] = [];
  const files: string[] = [];
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    let info: ReturnType<typeof statSync>;
    try {
      info = statSync(join(dirPath, name));
    } catch {
      continue;
    }
    const encoded = encodeURIComponent(name);
    if (info.isDirectory()) dirs.push(`- [${name}/](${encoded}/)`);
    else if (info.isFile()) files.push(`- [${name}](${encoded})`);
  }

  const sortByLower = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase());
  dirs.sort(sortByLower);
  files.sort(sortByLower);

  const body = [...dirs, ...files].join("\n");
  if (!body) return `# ${urlPath}\n\n_Empty directory._\n`;
  return `# ${urlPath}\n\n${body}\n`;
}

async function servePage(
  res: ServerResponse,
  md: MarkdownIt,
  source: string,
  fallbackTitle: string,
  boundingBox: boolean,
  directory: string,
  currentUrlPath: string,
  live: LiveReloadHandle | null,
  sourceToEmbed: string | null,
  all: boolean,
  code: boolean,
): Promise<void> {
  const { html, title } = render(md, source);

  let explorer = "";
  let fileIndex = "";
  try {
    const tree = buildTree(directory, { all, code });
    explorer = renderTree(tree, currentUrlPath);
    // Inline JSON for the client-side file-search modal. Closing `</`
    // sequences must be escaped so the script tag doesn't end early.
    fileIndex = JSON.stringify(flattenTree(tree)).replace(/<\/(script|!--)/gi, "<\\/$1");
  } catch {
    // tree build can fail on permissions / racy fs — degrade silently
  }

  // Same `</script>` escape as fileIndex; the client unescapes via JSON.parse.
  const sourceJson =
    sourceToEmbed !== null
      ? JSON.stringify(sourceToEmbed).replace(/<\/(script|!--)/gi, "<\\/$1")
      : "";

  const values: LayoutValues = {
    Title: escapeHtml(title || fallbackTitle),
    Content: html,
    FileExplorer: explorer,
    FileIndex: fileIndex,
    Source: sourceJson,
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
