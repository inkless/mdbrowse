import type { PluginSimple } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
type AlertType = (typeof ALERT_TYPES)[number];

const MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\r?\n?/;

// SVG octicon paths copied from goldmark's `pkg/alert` test fixtures so the
// rendered HTML byte-for-byte matches go-grip's output.
const OCTICONS: Record<AlertType, string> = {
  NOTE: '<svg class="octicon octicon-info mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
  TIP: '<svg class="octicon octicon-light-bulb mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"></path></svg>',
  IMPORTANT:
    '<svg class="octicon octicon-report mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
  WARNING:
    '<svg class="octicon octicon-alert mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path></svg>',
  CAUTION:
    '<svg class="octicon octicon-stop mr-2" viewBox="0 0 16 16" version="1.1" width="16" height="16" aria-hidden="true"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>',
};

function titleCase(t: AlertType): string {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

/**
 * GitHub-flavored alerts: blockquotes whose first line is `[!NOTE]`,
 * `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]` are rewritten as
 * `<div class="markdown-alert markdown-alert-<type>">` with a title row that
 * includes a GitHub octicon SVG.
 *
 * Output matches go-grip's `pkg/alert` byte-for-byte (same octicon paths).
 */
export const githubAlertsPlugin: PluginSimple = (md) => {
  md.core.ruler.after("block", "github-alert", (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      const open = tokens[i];
      if (!open || open.type !== "blockquote_open") continue;

      // Find the first inline token within this blockquote (skipping nested
      // structures we don't care about).
      let inlineIdx = -1;
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j];
        if (!t) break;
        if (t.type === "blockquote_close") break;
        if (t.type === "inline") {
          inlineIdx = j;
          break;
        }
      }
      if (inlineIdx === -1) continue;

      const inline = tokens[inlineIdx];
      if (!inline) continue;

      const m = MARKER.exec(inline.content);
      if (!m) continue;
      const type = m[1] as AlertType;

      stripMarker(inline, type);

      // Find the matching blockquote_close.
      let closeIdx = -1;
      let depth = 1;
      for (let k = i + 1; k < tokens.length; k++) {
        const t = tokens[k];
        if (!t) break;
        if (t.type === "blockquote_open") depth++;
        else if (t.type === "blockquote_close") {
          depth--;
          if (depth === 0) {
            closeIdx = k;
            break;
          }
        }
      }
      if (closeIdx === -1) continue;

      const close = tokens[closeIdx];
      if (!close) continue;

      // Mutate the opening blockquote to a styled <div>.
      open.tag = "div";
      open.attrJoin("class", `markdown-alert markdown-alert-${type.toLowerCase()}`);
      close.tag = "div";

      // Insert a `<p class="markdown-alert-title">…</p>` right after the open.
      const titleHtml = `<p class="markdown-alert-title">${OCTICONS[type]}${titleCase(type)}</p>`;
      const titleToken = new state.Token("html_block", "", 0);
      titleToken.content = `${titleHtml}\n`;
      titleToken.block = true;
      tokens.splice(i + 1, 0, titleToken);
    }
    return false;
  });
};

function stripMarker(inline: Token, type: AlertType): void {
  // Strip the leading `[!TYPE]` plus following whitespace/newline from
  // .content and from the parsed children.
  inline.content = inline.content.replace(MARKER, "");

  if (!inline.children) return;

  const markerLen = `[!${type}]`.length;
  const first = inline.children[0];
  if (!first) return;

  if (first.type === "text" && first.content.startsWith(`[!${type}]`)) {
    first.content = first.content.slice(markerLen).replace(/^[ \t]*/, "");
    if (first.content === "") {
      inline.children.shift();
    }
  }
  // Drop a leading softbreak left by `> [!NOTE]\n> body`.
  if (inline.children[0]?.type === "softbreak") {
    inline.children.shift();
  }
}
