import { basename, extname } from "node:path";

/**
 * Filename extension → shiki language id. Only entries whose language is
 * loaded by `buildHighlighter()` (see `plugins/highlight.ts` DEFAULT_LANGS)
 * should appear here — unknown langs would fall back to plaintext anyway,
 * but listing only loaded ones documents the actual coverage.
 *
 * `.html`, `.htm`, and `.svg` are deliberately omitted: browsers render
 * them natively and that's almost always what the user wants.
 */
const EXT_LANG: Record<string, string> = {
  ".bash": "bash",
  ".cjs": "javascript",
  ".css": "css",
  ".cts": "typescript",
  ".diff": "diff",
  ".fish": "shellscript",
  ".go": "go",
  ".gql": "graphql",
  ".graphql": "graphql",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsonc": "json",
  ".jsx": "jsx",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".lua": "lua",
  ".mjs": "javascript",
  ".mts": "typescript",
  ".patch": "diff",
  ".php": "php",
  ".plist": "xml",
  ".py": "python",
  ".pyw": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "scss",
  ".sh": "bash",
  ".sql": "sql",
  ".swift": "swift",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".vue": "vue",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".zig": "zig",
  ".zsh": "shellscript",
};

/**
 * Bare filenames (no extension) that map to a known language.
 */
const FILENAME_LANG: Record<string, string> = {
  Dockerfile: "dockerfile",
  Makefile: "makefile",
};

/**
 * Look up the shiki language id for a given filesystem path. Returns null
 * when the path doesn't match a known code/config file — the caller should
 * then fall back to plaintext or raw bytes.
 */
export function detectCodeLanguage(filePath: string): string | null {
  const name = basename(filePath);
  if (FILENAME_LANG[name]) return FILENAME_LANG[name];
  const ext = extname(name).toLowerCase();
  return EXT_LANG[ext] ?? null;
}

/** True when the path is recognized as a code/config file. */
export function isCodeFile(filePath: string): boolean {
  return detectCodeLanguage(filePath) !== null;
}

/**
 * Wrap arbitrary source in a fenced code block whose fence is one backtick
 * longer than the longest backtick run inside the source. This guarantees
 * the fence can't be terminated early by content like
 * `` ```js ... ``` `` embedded in a markdown file's source.
 */
export function wrapAsFencedMarkdown(source: string, lang: string): string {
  let max = 0;
  const re = /`+/g;
  let m: RegExpExecArray | null = re.exec(source);
  while (m !== null) {
    if (m[0].length > max) max = m[0].length;
    m = re.exec(source);
  }
  const fence = "`".repeat(Math.max(3, max + 1));
  const trailingNewline = source.endsWith("\n") ? "" : "\n";
  return `${fence}${lang}\n${source}${trailingNewline}${fence}\n`;
}
