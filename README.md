# mdbrowse

Browse a folder of Markdown locally as a GitHub-styled site. **No GitHub API calls** — everything renders in-process.

What you get out of the box:

- a **file-tree sidebar** that scans the served directory and highlights the current file
- a **⌘K / Ctrl+K file picker** with fzf-style subsequence matching across filenames + folders
- **websocket live reload** across the whole tree on save (not just the open file)
- **synthetic directory listings** when a folder has no `README.md`, so URLs never dead-end on a 404
- **GitHub-flavored alerts** (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`) with the real octicon SVGs
- **dual-theme syntax highlighting** via [shiki](https://shiki.style) — one render serves both `github-light` and `github-dark`, swaps via CSS variables
- client-side **Mermaid** + **MathJax** (inline `$x$`, block `$$x$$`, fenced ` ```math `)
- a typed **programmatic API** — `renderMarkdown`, `renderMarkdownWithHighlighting`, `serveMarkdown` — for embedding inside a Node service
- ships as an npm package: `npx`, `pnpm dlx`, or global install — no Go/Python toolchain required

## Install

```bash
# global
pnpm add -g @inkless/mdbrowse
npm  i  -g @inkless/mdbrowse
yarn global add @inkless/mdbrowse

# one-shot, no install
pnpm dlx @inkless/mdbrowse
npx       @inkless/mdbrowse
yarn dlx  @inkless/mdbrowse   # yarn 2+ (Berry)
```

The npm package is published as `@inkless/mdbrowse`; the binary it installs on your PATH is `mdbrowse`.

## Usage

`mdbrowse` always serves the **current directory** as a browsable site (sidebar lists every `.md` file under it; `Cmd+K` searches across the whole tree). The optional positional argument is just which page to **land on** first — pass nothing and you land on `./README.md` if it exists, otherwise on a synthetic directory listing.

```bash
mdbrowse                       # serve cwd; land on ./README.md if present
mdbrowse docs/guide.md         # serve cwd; land on /docs/guide.md
mdbrowse docs/                 # serve cwd; land on /docs/ (its README or listing)
mdbrowse -p 3000               # custom port (falls back to next free if busy)
mdbrowse --no-browser          # don't auto-open the browser
mdbrowse --no-reload           # disable live reload on file changes
mdbrowse -H 0.0.0.0            # bind to all interfaces (LAN access)
mdbrowse --all                 # also include dotfiles + node_modules / dist / …
```

The default URL is `http://localhost:6419/`. Hit **Ctrl-C** to stop.

To serve a different directory, `cd` into it first — `mdbrowse` always treats the current working directory as the root of the site.

### CLI reference

```
mdbrowse [options] [file]

Arguments:
  file                  Page to land on first (defaults to README.md in the
                        current directory if present). The whole directory is
                        always served — this argument is just the initial URL.

Options:
  -v, --version         Print version and exit
  -b, --browser         Open in browser on start (default)
      --no-browser      Do not open the browser
  -H, --host <host>     Host to bind (default: localhost)
  -p, --port <port>     Port to bind; falls back to the next free port if busy (default: 6419)
      --bounding-box    Wrap content in GitHub bounding box (default)
      --no-bounding-box Disable bounding box
      --no-reload       Disable browser auto-reload on file changes
      --all             Show every directory in the sidebar + ⌘K search,
                        including dotfiles and node_modules / dist / etc.
                        (off by default)
  -h, --help            Display help
```

## Features

- 📄 **GitHub-styled rendering** — heading anchors, GFM tables, strikethrough, autolinking, footnotes, task lists
- 🎨 **Syntax highlighting** via [shiki](https://shiki.style) with built-in `github-light` and `github-dark` themes (dual-theme via CSS variables, swaps on theme toggle)
- 📦 **GitHub-flavored alerts** — `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`
- 🔗 **Issue/PR references** — `#123` (auto-linked when run inside a GitHub repo) and `owner/repo#123`
- 🧩 **Mermaid diagrams** rendered client-side
- ➕ **Math** via MathJax (inline `$x$`, block `$$x$$`, fenced ` ```math `)
- 🖼️ **`<details>` state preserved** across reloads (sessionStorage)
- 🌗 **Light/dark theme toggle** with system-preference detection
- 📁 **File-tree sidebar** — automatically built from the served directory, current file highlighted
- 🔍 **File search** — `Cmd+K` / `Ctrl+K` opens a fzf-style picker that matches filenames and folder names; arrow keys + Enter to jump
- 🔄 **Live reload** over websocket on file changes (disable with `--no-reload`)
- 😀 **GitHub emoji shortcodes** (`:ship:` → 🚢)
- 🚫 **No external API calls** — works fully offline

## Programmatic API

`mdbrowse` is also a library:

```ts
import { renderMarkdown, renderMarkdownWithHighlighting, serveMarkdown } from "@inkless/mdbrowse";

// Sync render, no syntax highlighting (fastest):
const { html, title } = renderMarkdown("# hello\n");

// Async render with shiki syntax highlighting:
const { html: html2 } = await renderMarkdownWithHighlighting("```js\nconst x=1\n```\n");

// Spin up the local server programmatically:
const handle = await serveMarkdown("README.md", {
  host: "localhost",
  port: 3000,
  browser: false,
});
console.log(handle.url);
await handle.close();
```

For repeated rendering (e.g. inside a long-running server), build the renderer once:

```ts
import { createRendererWithHighlighting, render } from "@inkless/mdbrowse";
const md = await createRendererWithHighlighting();
for (const doc of docs) {
  const { html } = render(md, doc);
  // …
}
```

### Repository auto-detection

Bare `#NNN` references (without an `owner/repo` prefix) only resolve to GitHub URLs when a repository is configured. The CLI auto-detects via `git remote get-url origin` in the served directory. To override programmatically:

```ts
renderMarkdown(md, { repository: "octocat/hello-world" });
```

## Heritage

`mdbrowse` started as a Node.js port of [`go-grip`](https://github.com/inkless/go-grip) (itself a Go port of [`grip`](https://github.com/joeyespo/grip)). It has since grown beyond the original "preview a single README" framing into a folder browser: sidebar nav across the tree, ⌘K search, synthetic directory listings, and a programmatic API for embedding the renderer/server in your own Node code.

## Development

```bash
git clone git@github.com:inkless/mdbrowse.git
cd mdbrowse
pnpm install

pnpm dev          # tsup watch
pnpm test         # vitest
pnpm lint         # biome
pnpm typecheck    # tsc --noEmit
pnpm build        # one-shot build to dist/
node dist/cli.js README.md
```

## Releases

Versioning + changelog are automated by [Release Please](https://github.com/googleapis/release-please). Commit to `main` using [Conventional Commits](https://www.conventionalcommits.org/) (`feat: …`, `fix: …`, `docs: …`, `chore: …`); the action keeps a single open "Release PR" that bumps `package.json` and updates [`CHANGELOG.md`](./CHANGELOG.md). Merging the Release PR cuts the `vX.Y.Z` tag, which triggers `release.yml` to publish to npm via Trusted Publishing OIDC.

## License

MIT © Guangda Zhang
