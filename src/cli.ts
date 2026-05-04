import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { serveMarkdown } from "./server.js";

interface PackageJson {
  name: string;
  version: string;
  description: string;
}

function readPackageJson(): PackageJson {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;
}

interface ServeCliOptions {
  browser: boolean;
  host: string;
  port: number;
  boundingBox: boolean;
  reload: boolean;
  all: boolean;
}

export function createProgram(): Command {
  const pkg = readPackageJson();
  const program = new Command();

  // Help/usage shows the binary name, not the (scoped) package name.
  program
    .name("mdbrowse")
    .description(pkg.description)
    .version(pkg.version, "-v, --version", "Print version and exit")
    .argument(
      "[file]",
      "Page to land on first (defaults to README.md if present). The whole current directory is always served — this is just the initial URL.",
    )
    .option("-b, --browser", "Open in browser on start", true)
    .option("--no-browser", "Do not open the browser")
    .option("-H, --host <host>", "Host to bind", "localhost")
    .option("-p, --port <port>", "Port to bind", (v) => Number.parseInt(v, 10), 6419)
    .option("--bounding-box", "Wrap content in GitHub bounding box", true)
    .option("--no-bounding-box", "Disable bounding box")
    .option("--no-reload", "Disable browser auto-reload on file changes")
    .option(
      "--all",
      "Show every directory in the sidebar + ⌘K search, including dotfiles and node_modules / dist / build / etc. (off by default)",
      false,
    )
    .action(async (file: string | undefined, opts: ServeCliOptions) => {
      await serveMarkdown(file ?? null, {
        host: opts.host,
        port: opts.port,
        browser: opts.browser,
        boundingBox: opts.boundingBox,
        reload: opts.reload,
        all: opts.all,
      });
    });

  return program;
}

createProgram().parseAsync(process.argv);
