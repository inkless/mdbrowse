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
}

export function createProgram(): Command {
  const pkg = readPackageJson();
  const program = new Command();

  program
    .name(pkg.name)
    .description(pkg.description)
    .version(pkg.version, "-v, --version", "Print version and exit")
    .argument("[file]", "Markdown file to render (defaults to README.md in cwd if present)")
    .option("-b, --browser", "Open in browser on start", true)
    .option("--no-browser", "Do not open the browser")
    .option("-H, --host <host>", "Host to bind", "localhost")
    .option("-p, --port <port>", "Port to bind", (v) => Number.parseInt(v, 10), 6419)
    .option("--bounding-box", "Wrap content in GitHub bounding box", true)
    .option("--no-bounding-box", "Disable bounding box")
    .option("--no-reload", "Disable browser auto-reload on file changes")
    .action(async (file: string | undefined, opts: ServeCliOptions) => {
      await serveMarkdown(file ?? null, {
        host: opts.host,
        port: opts.port,
        browser: opts.browser,
        boundingBox: opts.boundingBox,
        reload: opts.reload,
      });
    });

  return program;
}

createProgram().parseAsync(process.argv);
