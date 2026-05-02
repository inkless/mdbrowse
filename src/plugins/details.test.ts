import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../render.js";

describe("details (stateful)", () => {
  it("adds a unique id to a <details> block and appends the state script", () => {
    const md = "<details>\n<summary>x</summary>\n\nbody\n\n</details>\n";
    const { html } = renderMarkdown(md);
    expect(html).toMatch(/<details[^>]*\sid="details-1-[0-9a-f]{12}"/);
    expect(html).toContain("sessionStorage.getItem('details-state-' +");
    // Script should be appended exactly once.
    const scriptCount = (html.match(/initDetailsState/g) ?? []).length;
    expect(scriptCount).toBeGreaterThanOrEqual(1);
  });

  it("does not inject the script when there are no <details> blocks", () => {
    const { html } = renderMarkdown("# heading\n\nbody\n");
    expect(html).not.toContain("initDetailsState");
  });

  it("keeps existing id attributes", () => {
    const md = '<details id="custom">\n<summary>x</summary>\nbody\n</details>\n';
    const { html } = renderMarkdown(md);
    expect(html).toContain('id="custom"');
    // No additional id added.
    expect(html.match(/\sid="/g)?.length).toBe(1);
  });
});
