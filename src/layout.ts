import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "assets",
  "templates",
  "layout.html",
);

let cachedTemplate: string | null = null;

function loadTemplate(): string {
  if (cachedTemplate === null) {
    cachedTemplate = readFileSync(TEMPLATE_PATH, "utf8");
  }
  return cachedTemplate;
}

export interface LayoutValues {
  Title: string;
  Content: string;
  FileExplorer: string;
  /**
   * JSON-encoded `FileEntry[]` for the client-side file-search modal.
   * Empty string means search is disabled (no markdown files in the
   * served directory).
   */
  FileIndex: string;
  /**
   * JSON-encoded raw markdown source of the current page, embedded so
   * the client-side "copy source" button doesn't need a round trip.
   * Empty string means the source isn't a real on-disk file (e.g., a
   * synthetic directory listing) and the copy button should be hidden.
   */
  Source: string;
  BoundingBox: boolean;
}

/**
 * Render `assets/templates/layout.html` with a tiny, hand-rolled subset of
 * Go's `text/template` syntax: `{{ .Field }}` interpolation and
 * `{{if .Field}}…{{end}}` conditionals. That's all the layout uses.
 *
 * String values are inserted verbatim — this is **not** a generic templating
 * engine. Callers are responsible for the HTML-safety of each value:
 *   - `Title` is escape-quoted before being passed in (see server.ts).
 *   - `Content` and `FileExplorer` are already-rendered HTML.
 */
export function renderLayout(values: LayoutValues): string {
  let html = loadTemplate();

  html = html.replace(/\{\{if\s+\.(\w+)\}\}([\s\S]*?)\{\{end\}\}/g, (_, key, body) => {
    const v = values[key as keyof LayoutValues];
    return v ? body : "";
  });

  html = html.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, key) => {
    const v = values[key as keyof LayoutValues];
    if (typeof v === "boolean") return v ? "true" : "";
    return v ?? "";
  });

  return html;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
