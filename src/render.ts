import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import { full as emoji } from "markdown-it-emoji";
import footnote from "markdown-it-footnote";
import mathjax from "markdown-it-mathjax3";
import taskLists from "markdown-it-task-lists";
import { githubAlertsPlugin } from "./plugins/alerts.js";
import { detailsPlugin } from "./plugins/details.js";
import { ghIssuePlugin } from "./plugins/ghissue.js";
import {
  attachHighlighter,
  buildHighlighter,
  type HighlighterOptions,
} from "./plugins/highlight.js";
import { mermaidPlugin } from "./plugins/mermaid.js";

export interface RenderResult {
  html: string;
  title: string;
}

export interface RenderOptions {
  /**
   * Render mermaid fences as `<div class="mermaid">…</div>` for client-side
   * rendering (matching `go-grip`'s `RenderModeClient` + `NoScript: true`).
   * Default true.
   */
  mermaid?: boolean;
  /**
   * `owner/repo` slug for resolving bare `#NNN` issue references. When
   * unset, bare `#NNN` is left as plain text. `owner/repo#NNN` works
   * regardless. Auto-detected from `git remote get-url origin` by the CLI.
   */
  repository?: string;
}

export function createRenderer(options: RenderOptions = {}): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
  });

  // enabled:false → render checkboxes as `disabled`, matching grip / GitHub
  // (read-only preview, not interactive).
  md.use(taskLists, { enabled: false, label: true, labelAfter: true });
  md.use(footnote);
  md.use(emoji);
  md.use(anchor, {
    // `linkInsideHeader` keeps the heading text plain and inserts a
    // sibling `<a class="anchor">` — matching the structure the vendored
    // GitHub markdown CSS targets (`.markdown-body h1:hover .anchor`).
    // `headerLink` would wrap the whole text in `<a>`, which the CSS
    // styles as a blue underlined link.
    permalink: anchor.permalink.linkInsideHeader({
      class: "anchor",
      symbol: '<span aria-hidden="true" class="octicon octicon-link"></span>',
      placement: "before",
      ariaHidden: true,
    }),
    slugify: (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-"),
  });
  md.use(mathjax);
  md.use(githubAlertsPlugin);
  md.use(ghIssuePlugin, { repository: options.repository });
  md.use(detailsPlugin);

  if (options.mermaid !== false) {
    md.use(mermaidPlugin);
  }

  return md;
}

const defaultRenderer = createRenderer();

/**
 * Build a renderer with shiki syntax highlighting wired up. Use the
 * returned instance directly with `renderHtml`/`renderTokens`.
 *
 * Building the highlighter is async and not free — call this once at
 * startup and reuse the result across many renders.
 */
export async function createRendererWithHighlighting(
  options: RenderOptions & HighlighterOptions = {},
): Promise<MarkdownIt> {
  const md = createRenderer(options);
  const highlighter = await buildHighlighter(options);
  attachHighlighter(md, highlighter, options);
  return md;
}

/**
 * One-shot render with shiki highlighting. Builds a highlighter on every
 * call — convenient for ad-hoc use, but for repeated rendering prefer
 * `createRendererWithHighlighting()` + `render(md, input)`.
 */
export async function renderMarkdownWithHighlighting(
  input: string,
  options?: RenderOptions & HighlighterOptions,
): Promise<RenderResult> {
  const md = await createRendererWithHighlighting(options ?? {});
  return render(md, input);
}

export function render(md: MarkdownIt, input: string): RenderResult {
  const env: Record<string, unknown> = {};
  const tokens = md.parse(input, env);
  const html = md.renderer.render(tokens, md.options, env);
  const title = firstH1(tokens);
  return { html, title };
}

export function renderMarkdown(input: string, options?: RenderOptions): RenderResult {
  // Renderer instances are stateful for per-document features (e.g. details
  // counter), so build a fresh one when caller-specific options are given;
  // for the no-options fast path we still reuse the default. The default
  // renderer's per-call state is reset because we go through `parse` →
  // `render` rather than holding intermediate state on the instance.
  const md = options ? createRenderer(options) : defaultRenderer;
  const env: Record<string, unknown> = {};
  const tokens = md.parse(input, env);
  const html = md.renderer.render(tokens, md.options, env);
  const title = firstH1(tokens);
  return { html, title };
}

function firstH1(tokens: ReturnType<MarkdownIt["parse"]>): string {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t?.type === "heading_open" && t.tag === "h1") {
      const inline = tokens[i + 1];
      if (inline?.type !== "inline") continue;
      // After markdown-it-anchor's headerLink permalink, the inline's `.content`
      // is empty because text gets wrapped in link_open/link_close. Walk
      // children for the actual text instead.
      const direct = (inline.content ?? "").trim();
      if (direct) return direct;
      return collectText(inline.children).trim();
    }
  }
  return "";
}

function collectText(children: ReturnType<MarkdownIt["parse"]>[number]["children"]): string {
  if (!children) return "";
  let out = "";
  for (const c of children) {
    if (c.type === "text" || c.type === "code_inline") out += c.content;
    else if (c.children) out += collectText(c.children);
  }
  return out;
}
