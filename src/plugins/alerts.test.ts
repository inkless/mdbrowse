import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../render.js";

describe("github alerts", () => {
  for (const [marker, klass, title] of [
    ["NOTE", "markdown-alert-note", "Note"],
    ["TIP", "markdown-alert-tip", "Tip"],
    ["IMPORTANT", "markdown-alert-important", "Important"],
    ["WARNING", "markdown-alert-warning", "Warning"],
    ["CAUTION", "markdown-alert-caution", "Caution"],
  ] as const) {
    it(`renders [!${marker}] as a styled alert div`, () => {
      const md = `> [!${marker}]\n> body line\n`;
      const { html } = renderMarkdown(md);
      expect(html).toContain(`<div class="markdown-alert ${klass}">`);
      expect(html).toContain(`<p class="markdown-alert-title">`);
      expect(html).toContain(title);
      expect(html).toContain("octicon");
      expect(html).toContain("body line");
      expect(html).not.toContain(`[!${marker}]`);
    });
  }

  it("supports multi-paragraph alerts", () => {
    const md = "> [!NOTE]\n> First paragraph.\n>\n> Second paragraph.\n";
    const { html } = renderMarkdown(md);
    expect(html).toContain('<div class="markdown-alert markdown-alert-note">');
    expect(html).toContain("<p>First paragraph.</p>");
    expect(html).toContain("<p>Second paragraph.</p>");
  });

  it("leaves non-alert blockquotes alone", () => {
    const { html } = renderMarkdown("> just a quote\n");
    expect(html).toContain("<blockquote>");
    expect(html).not.toContain("markdown-alert");
  });

  it("ignores unknown markers like [!foo]", () => {
    const { html } = renderMarkdown("> [!FOO]\n> body\n");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("[!FOO]");
  });
});
