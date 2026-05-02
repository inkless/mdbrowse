import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./index.js";

describe("renderMarkdown — core", () => {
  it("renders an h1 and exposes its text as the title", () => {
    const { html, title } = renderMarkdown("# Hello world\n\nbody");
    expect(title).toBe("Hello world");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello world");
  });

  it("returns an empty title when there is no h1", () => {
    const { title } = renderMarkdown("## Subhead\n\nbody");
    expect(title).toBe("");
  });

  it("auto-links bare URLs (linkify)", () => {
    const { html } = renderMarkdown("Visit https://example.com today");
    expect(html).toContain('href="https://example.com"');
  });

  it("renders GFM tables", () => {
    const { html } = renderMarkdown("| a | b |\n| - | - |\n| 1 | 2 |\n");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("renders strikethrough", () => {
    const { html } = renderMarkdown("~~gone~~");
    expect(html).toContain("<s>gone</s>");
  });

  it("passes through raw HTML (html: true)", () => {
    const { html } = renderMarkdown("<details><summary>x</summary>y</details>");
    expect(html).toContain("<details>");
    expect(html).toContain("<summary>x</summary>");
  });
});

describe("renderMarkdown — task lists", () => {
  it("renders checked and unchecked task items as disabled checkboxes", () => {
    const { html } = renderMarkdown("- [ ] todo\n- [x] done\n");
    // Two <input> tags, both disabled; the second is also checked. Attribute
    // order in markdown-it-task-lists is unstable, so we count occurrences.
    const inputs = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(2);
    expect(inputs.every((tag) => tag.includes('disabled="'))).toBe(true);
    expect(inputs.filter((tag) => tag.includes('checked="'))).toHaveLength(1);
  });
});

describe("renderMarkdown — footnotes", () => {
  it("renders footnote refs and the footnotes block", () => {
    const md = "Cite this[^a].\n\n[^a]: A footnote.\n";
    const { html } = renderMarkdown(md);
    expect(html).toContain('class="footnote-ref"');
    expect(html).toContain("A footnote.");
  });
});

describe("renderMarkdown — emoji", () => {
  it("expands GitHub-style :shortcodes:", () => {
    const { html } = renderMarkdown("Ship it :ship:");
    // markdown-it-emoji renders to the unicode glyph by default.
    expect(html).toContain("🚢");
  });
});

describe("renderMarkdown — heading anchors", () => {
  it("adds id slugs to headings", () => {
    const { html } = renderMarkdown("## Section A\n");
    expect(html).toMatch(/<h2[^>]*id="section-a"/);
  });
});

describe("renderMarkdown — math", () => {
  it("renders inline math via mathjax", () => {
    const { html } = renderMarkdown("This is $\\sqrt{2}$ inline.");
    expect(html).toMatch(/<mjx-container|<svg/);
  });

  it("renders block math via mathjax", () => {
    const { html } = renderMarkdown("$$\\frac{1}{2}$$\n");
    expect(html).toMatch(/<mjx-container|<svg/);
  });
});

describe("renderMarkdown — mermaid", () => {
  it("rewrites ```mermaid fences to a client-render div", () => {
    const md = "```mermaid\ngraph TD;\n  A-->B;\n```\n";
    const { html } = renderMarkdown(md);
    expect(html).toContain('<div class="mermaid">');
    expect(html).toContain("graph TD;");
    expect(html).toContain("A--&gt;B;");
  });

  it("leaves other code fences alone", () => {
    const { html } = renderMarkdown("```js\nconst x = 1;\n```\n");
    expect(html).toContain("<code");
    expect(html).not.toContain('class="mermaid"');
  });
});
