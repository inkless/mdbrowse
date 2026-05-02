import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

interface PackageJson {
  name: string;
  version: string;
  description: string;
}

function readPackageJson(): PackageJson {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli.js → ../package.json
  const pkgPath = resolve(here, "..", "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;
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
    .action(async (file: string | undefined, opts: ServeOptions) => {
      // Phase 4 will wire this to the server. For now, print the parsed config.
      const config = {
        file: file ?? null,
        host: opts.host,
        port: opts.port,
        browser: opts.browser,
        boundingBox: opts.boundingBox,
        reload: opts.reload,
      };
      console.log("mdgrip configured:", JSON.stringify(config, null, 2));
      console.log("(server not yet implemented — see PLAN.md Phase 4)");
    });

  return program;
}

interface ServeOptions {
  browser: boolean;
  host: string;
  port: number;
  boundingBox: boolean;
  reload: boolean;
}

createProgram().parseAsync(process.argv);
