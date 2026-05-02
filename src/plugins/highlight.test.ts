import { describe, expect, it } from "vitest";
import {
  createRendererWithHighlighting,
  render,
  renderMarkdownWithHighlighting,
} from "../render.js";

describe("shiki highlighter", () => {
  it("emits dual-themed shiki HTML for known languages", async () => {
    const md = "```javascript\nconst x = 1;\n```\n";
    const { html } = await renderMarkdownWithHighlighting(md);
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
    // Tokens become <span> with inline color CSS variables.
    expect(html).toMatch(/<span[^>]+--shiki-light:#/);
  });

  it("falls back to plaintext styling for unknown languages", async () => {
    const md = "```neverlang\nfoo\n```\n";
    const { html } = await renderMarkdownWithHighlighting(md);
    expect(html).toContain("shiki");
    // text fallback still wraps content in <pre><code>
    expect(html).toContain("foo");
  });

  it("reuses a built renderer for many renders", async () => {
    const renderer = await createRendererWithHighlighting();
    const a = render(renderer, "```ts\ntype X = 1;\n```\n");
    const b = render(renderer, "```python\nx = 1\n```\n");
    expect(a.html).toContain("shiki");
    expect(b.html).toContain("shiki");
    expect(a.html).not.toBe(b.html);
  });
}, 30_000);
