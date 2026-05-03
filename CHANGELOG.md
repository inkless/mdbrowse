# Changelog

All notable changes to `@inkless/mdbrowse` are documented in this file. From 0.2.3 onward this file is maintained automatically by [Release Please](https://github.com/googleapis/release-please) from Conventional Commit messages on `main`. The 0.1.0 → 0.2.2 entries below were backfilled by hand.

## [0.2.2](https://github.com/inkless/mdbrowse/compare/v0.2.1...v0.2.2)

### Bug Fixes

- **ui:** reserve top space on mobile so the fixed toolbar (hamburger / search / width / theme) stops overlapping the page H1 below the 940px breakpoint ([437e59d](https://github.com/inkless/mdbrowse/commit/437e59d))

### Documentation

- lead `README.md` and the npm package description with the current feature set (sidebar, ⌘K search, live reload, synthetic dir listings, dual-theme shiki, programmatic API); demote the grip / go-grip lineage to a brief Heritage section ([c717d5f](https://github.com/inkless/mdbrowse/commit/c717d5f))

## [0.2.1](https://github.com/inkless/mdbrowse/compare/v0.1.0...v0.2.1)

The 0.2.0 tag was created but never published — `pnpm publish` doesn't perform npm-registry OIDC token exchange (only Sigstore provenance signing), so the release workflow's upload returned 404. 0.2.1 bundles the 0.2.0 changes with the workflow fixes and a few additional bug fixes.

### Features

- **search:** Cmd/Ctrl+K file search modal with fzf-style subsequence matching across filenames + folder names, native `<dialog>` for focus-trap + Esc, arrow-key navigation ([4e74577](https://github.com/inkless/mdbrowse/commit/4e74577))
- **server:** synthetic directory listing when a folder has no `README.md`, instead of a 404 dead-end ([6d765e0](https://github.com/inkless/mdbrowse/commit/6d765e0))

### Bug Fixes

- **server:** redirect-loop on directory URLs with a trailing slash ([66dc047](https://github.com/inkless/mdbrowse/commit/66dc047))
- **render:** stop heading text from rendering as a blue hyperlink (anchor mode `headerLink` → `linkInsideHeader`) ([c080406](https://github.com/inkless/mdbrowse/commit/c080406))
- **mermaid:** anchor zoom/pan toolbar to the diagram instead of the viewport ([bfa7d8b](https://github.com/inkless/mdbrowse/commit/bfa7d8b))
- **search:** respect explicit theme (`data-theme` on `<body>`) over system preference inside the modal ([8a0c250](https://github.com/inkless/mdbrowse/commit/8a0c250))

### CI

- switch to `npm publish` (npm 11.x via Node 24 LTS) for Trusted Publishing OIDC; previous `pnpm publish` couldn't exchange the GitHub OIDC token for an npm upload token ([d925221](https://github.com/inkless/mdbrowse/commit/d925221), [e60b007](https://github.com/inkless/mdbrowse/commit/e60b007), [2453890](https://github.com/inkless/mdbrowse/commit/2453890))
- add a separate Playwright e2e job, gated by `pnpm exec playwright install --with-deps chromium` ([0570d75](https://github.com/inkless/mdbrowse/commit/0570d75))

## [0.1.0](https://github.com/inkless/mdbrowse/releases/tag/v0.1.0)

First public release. Initial scope: feature-parity with [`go-grip`](https://github.com/inkless/go-grip) plus a folder-browser framing.

### Features

- **render:** GitHub-styled Markdown rendering via `markdown-it` 14 + anchor + task-lists + footnote + emoji (full GitHub set) + mathjax3 + custom mermaid client-render fence rule
- **plugins:** GitHub-flavored alerts (`> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`) with the real octicon SVGs; auto-linked `#NNN` issue references (when run inside a git repo); `<details>` state preservation across reloads via sessionStorage
- **highlight:** dual-theme syntax highlighting via [shiki](https://shiki.style) (`github-light` + `github-dark` via CSS variables; ~31 default langs preloaded; `createRendererWithHighlighting()` for reuse across requests)
- **server:** Node native HTTP server; `/static/*` from bundled assets, `/*.md` rendered on the fly, plain static fallback; path-traversal-safe; tiny Go-template subset interpreter for `layout.html`
- **tree:** file-tree sidebar that scans the served directory, sorts dirs first, filters dotfiles + non-md, highlights the current file, opens containing dirs by default
- **live-reload:** chokidar + ws on the same HTTP port (`/__mdbrowse_livereload`); auto-reconnect; gated by `--no-reload`
- **api:** typed programmatic API — `renderMarkdown`, `renderMarkdownWithHighlighting`, `serveMarkdown`, `createRendererWithHighlighting` — for embedding inside a Node service
- **cli:** `mdbrowse [options] [file]` with `--browser`, `--host`, `--port`, `--bounding-box`, `--no-reload` flags

### Distribution

- npm package published as `@inkless/mdbrowse` (binary command `mdbrowse`)
- Tag-triggered GitHub release workflow with `npm publish --access public --provenance` via Trusted Publishing OIDC (no `NPM_TOKEN` secret)
