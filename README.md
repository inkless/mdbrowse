# mdgrip

Render Markdown files locally with the look of GitHub. A Node.js port of [`go-grip`](https://github.com/inkless/go-grip) (which itself is a Go port of [`grip`](https://github.com/joeyespo/grip)). No GitHub API calls — all rendering happens locally.

> **Status:** under active development. The CLI scaffold is in place; rendering, server, and live reload land in subsequent phases.

## Install

```bash
# global
pnpm add -g mdgrip
# or one-shot
pnpm dlx mdgrip README.md
# or with npm/npx
npm i -g mdgrip
npx mdgrip README.md
```

## Usage

```bash
mdgrip [file]               # render <file> (defaults to ./README.md if present)
mdgrip -p 3000 README.md    # custom port
mdgrip --no-browser .       # don't auto-open browser
mdgrip --no-reload README.md  # disable live reload
```

Hit `Ctrl-C` to stop.

## Why

The original `grip` calls the GitHub Markdown API. `go-grip` removes that dependency by rendering everything in-process. `mdgrip` is the same idea in the Node.js ecosystem, so it integrates with `npx` / `pnpm dlx` / Node tooling without needing a Go toolchain.

## Development

```bash
pnpm install
pnpm dev          # tsup watch
pnpm test         # vitest
pnpm lint         # biome
pnpm build
node dist/cli.js --version
```

## Roadmap

See [the project plan](https://github.com/guangda-zhang/mdviewer/blob/main/PLAN.md) (mirrored in the project's memory bank) for the phased migration plan.

## License

MIT © Guangda Zhang
