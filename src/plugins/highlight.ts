import type MarkdownIt from "markdown-it";
import { createHighlighter, type Highlighter } from "shiki";

export type HighlightTheme = "github-light" | "github-dark";

const DEFAULT_LANGS = [
  "bash",
  "css",
  "diff",
  "dockerfile",
  "go",
  "graphql",
  "html",
  "java",
  "javascript",
  "json",
  "jsx",
  "kotlin",
  "lua",
  "makefile",
  "markdown",
  "nginx",
  "php",
  "python",
  "ruby",
  "rust",
  "scss",
  "shellscript",
  "sql",
  "swift",
  "toml",
  "tsx",
  "typescript",
  "vue",
  "xml",
  "yaml",
  "zig",
] as const;

export interface HighlighterOptions {
  /** Languages to load. Defaults to a curated common set. */
  langs?: readonly string[];
  /** Light theme. Defaults to `github-light`. */
  light?: HighlightTheme;
  /** Dark theme. Defaults to `github-dark`. */
  dark?: HighlightTheme;
}

/**
 * Build a shiki highlighter loaded with both themes and a sensible language
 * set. Reuse the result — building one is async and not free.
 */
export async function buildHighlighter(opts: HighlighterOptions = {}): Promise<Highlighter> {
  const themes = [opts.light ?? "github-light", opts.dark ?? "github-dark"];
  return await createHighlighter({
    themes,
    langs: [...(opts.langs ?? DEFAULT_LANGS)],
  });
}

/**
 * Wire a pre-built shiki highlighter as markdown-it's `highlight` callback.
 * Outputs dual-themed HTML using CSS variables (`--shiki-light` /
 * `--shiki-dark`), matching `go-grip`'s "ship both stylesheets, swap by
 * theme" behavior. The host page CSS picks which theme to use based on a
 * root-level class/attribute.
 *
 * Unknown languages and missing `lang` fall back to escaped plaintext, so a
 * fenced block without a language tag still renders inside `<pre><code>`.
 */
export function attachHighlighter(
  md: MarkdownIt,
  highlighter: Highlighter,
  opts: HighlighterOptions = {},
): void {
  const light = opts.light ?? "github-light";
  const dark = opts.dark ?? "github-dark";
  const loaded = new Set(highlighter.getLoadedLanguages());

  md.options.highlight = (code, lang) => {
    const language = lang && loaded.has(lang) ? lang : "text";
    try {
      return highlighter.codeToHtml(code, {
        lang: language,
        themes: { light, dark },
        defaultColor: false,
      });
    } catch {
      return ""; // fall back to markdown-it default fence rendering
    }
  };
}
