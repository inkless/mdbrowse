import { createHash } from "node:crypto";
import type { PluginWithOptions } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

export interface DetailsOptions {
  /** Prefix for generated `id="<prefix>N-<hash>"` attributes. Default `"details-"`. */
  idPrefix?: string;
}

const STATE_SCRIPT = `<script>
(function() {
  'use strict';
  function initDetailsState() {
    const details = document.querySelectorAll('details[id]');
    details.forEach(function(detail) {
      const id = detail.id;
      const savedState = sessionStorage.getItem('details-state-' + id);
      if (savedState === 'open') {
        detail.open = true;
      } else if (savedState === 'closed') {
        detail.open = false;
      }
      detail.addEventListener('toggle', function() {
        const state = detail.open ? 'open' : 'closed';
        sessionStorage.setItem('details-state-' + id, state);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDetailsState);
  } else {
    initDetailsState();
  }
})();
</script>
`;

function generateId(prefix: string, counter: number, content: string): string {
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
  return `${prefix}${counter}-${hash}`;
}

function injectId(html: string, id: string): string {
  const trimmed = html.replace(/^\s+/, "");
  const closeIdx = trimmed.indexOf(">");
  if (closeIdx === -1) return html;
  const opening = trimmed.slice(0, closeIdx);
  if (/\sid\s*=/.test(opening)) return html; // already has an id

  const beforeClose = opening.trimEnd();
  if (beforeClose.endsWith("/")) {
    // self-closing (unusual for <details>)
    return `${beforeClose.slice(0, -1)} id="${id}" />${trimmed.slice(closeIdx + 1)}`;
  }
  return `${opening} id="${id}"${trimmed.slice(closeIdx)}`;
}

/**
 * `<details>`/`<summary>` blocks get a unique `id` and a one-time
 * sessionStorage state-restorer script appended to the document. Matches
 * go-grip's `pkg/details` behavior, including the README's "toggle state is
 * preserved in sessionStorage" feature.
 */
export const detailsPlugin: PluginWithOptions<DetailsOptions> = (md, options) => {
  const idPrefix = options?.idPrefix ?? "details-";

  md.core.ruler.after("inline", "details-stateful", (state) => {
    let counter = 0;
    let touched = false;

    for (const token of state.tokens) {
      if (token.type !== "html_block") continue;
      const trimmed = token.content.trimStart();
      if (!trimmed.startsWith("<details")) continue;

      counter++;
      const id = generateId(idPrefix, counter, token.content);
      token.content = injectId(token.content, id);
      touched = true;
    }

    if (touched) {
      const scriptToken = appendScriptToken(state);
      state.tokens.push(scriptToken);
    }
    return false;
  });

  function appendScriptToken(state: { Token: typeof Token }): Token {
    const t = new state.Token("html_block", "", 0);
    t.content = STATE_SCRIPT;
    t.block = true;
    return t;
  }
};
