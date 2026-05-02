import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../render.js";

describe("ghissue — internal references", () => {
  it("links bare #NNN when a repository is configured", () => {
    const { html } = renderMarkdown("Fixes #42 for sure.", { repository: "octocat/hello" });
    expect(html).toContain(
      '<a href="https://github.com/octocat/hello/issues/42" class="issue-link">#42</a>',
    );
  });

  it("leaves bare #NNN as plain text when no repository configured", () => {
    const { html } = renderMarkdown("Fixes #42 for sure.");
    expect(html).toContain("#42");
    expect(html).not.toContain("issue-link");
  });

  it("does not match in mid-word like foo#42", () => {
    const { html } = renderMarkdown("not foo#42 here.", { repository: "x/y" });
    expect(html).not.toContain("issue-link");
    expect(html).toContain("foo#42");
  });

  it("does not link inside inline code", () => {
    const { html } = renderMarkdown("see `#42` here.", { repository: "x/y" });
    expect(html).not.toContain("issue-link");
    expect(html).toContain("<code>#42</code>");
  });

  it("does not link inside an existing link", () => {
    const { html } = renderMarkdown("[label #42](https://example.com)", { repository: "x/y" });
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("issue-link");
  });
});

describe("ghissue — external references", () => {
  it("links owner/repo#NNN regardless of configured repo", () => {
    const { html } = renderMarkdown("See grafana/grafana#22 for details.");
    expect(html).toContain(
      '<a href="https://github.com/grafana/grafana/issues/22" class="issue-link">grafana/grafana#22</a>',
    );
  });

  it("handles multiple issue refs in one paragraph", () => {
    const md = "Fixes #1 and grafana/grafana#22 today.";
    const { html } = renderMarkdown(md, { repository: "octocat/hello" });
    expect(html).toContain('href="https://github.com/octocat/hello/issues/1"');
    expect(html).toContain('href="https://github.com/grafana/grafana/issues/22"');
    // External takes precedence at the overlapping position; only one link
    // should appear for `grafana/grafana#22`.
    const matches = html.match(/issue-link/g) ?? [];
    expect(matches).toHaveLength(2);
  });
});
