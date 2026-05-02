import type { PluginSimple } from "markdown-it";

/**
 * Rewrite ` ```mermaid ` fenced blocks to `<div class="mermaid">…</div>` for
 * client-side rendering by mermaid.js (loaded from `/static/`). Matches
 * `go-grip`'s `mermaid.Extender{RenderMode: RenderModeClient, NoScript: true}`.
 */
export const mermaidPlugin: PluginSimple = (md) => {
  const defaultFence = md.renderer.rules.fence;
  if (!defaultFence) {
    throw new Error("markdown-it: default fence renderer not available");
  }

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    if (!token) return defaultFence(tokens, idx, options, env, self);

    const lang = (token.info ?? "").trim().split(/\s+/, 1)[0];
    if (lang === "mermaid") {
      return `<div class="mermaid">${md.utils.escapeHtml(token.content)}</div>\n`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };
};
