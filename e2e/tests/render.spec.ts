import { expect, test } from "@playwright/test";

test.describe("rendering", () => {
  test("loads README and shows the h1 + page title", async ({ page }) => {
    await page.goto("/README.md");
    await expect(page).toHaveTitle("Sample Project");
    await expect(page.locator("h1#sample-project")).toHaveText("Sample Project");
  });

  test("heading text is not wrapped in a hyperlink", async ({ page }) => {
    // markdown-it-anchor's `headerLink` permalink mode would wrap the
    // entire heading in `<a>`, which the GitHub CSS styles as a blue
    // underlined link. We use `linkInsideHeader` so the heading text
    // stays plain and a sibling `<a class="anchor">` is added (which
    // the CSS reveals on hover as an octicon-link icon).
    await page.goto("/README.md");
    const heading = page.locator("h1#sample-project");
    await expect(heading.locator("a.anchor")).toHaveCount(1);
    // No non-`.anchor` link should exist directly inside the heading.
    await expect(heading.locator("a:not(.anchor)")).toHaveCount(0);
  });

  test("syntax-highlights TypeScript code via shiki", async ({ page }) => {
    await page.goto("/README.md");
    const code = page.locator("pre.shiki").first();
    await expect(code).toBeVisible();
    await expect(code.locator("code")).toContainText("export function greet");
    // Shiki applies inline color styles to tokens — at least one token in the
    // block should carry a `style="--shiki-light:` attribute.
    const styled = code.locator('span[style*="--shiki-light"]').first();
    await expect(styled).toHaveCount(1);
  });

  test("renders GitHub-style alert blockquotes", async ({ page }) => {
    await page.goto("/README.md");
    await expect(page.locator(".markdown-alert.markdown-alert-note")).toBeVisible();
    await expect(page.locator(".markdown-alert.markdown-alert-warning")).toBeVisible();
  });

  test("file-tree sidebar lists the fixture files", async ({ page }) => {
    await page.goto("/README.md");
    const tree = page.locator("#file-explorer");
    await expect(tree).toBeVisible();
    await expect(tree).toContainText("README.md");
    await expect(tree).toContainText("docs");
    await expect(tree).toContainText("guide.md");
  });

  test("clicking a sidebar link navigates to the other file", async ({ page }) => {
    await page.goto("/README.md");
    // The `docs/` directory is collapsed when viewing a root-level file —
    // expand it before clicking the nested link.
    await page.locator("#file-explorer details").first().locator("summary").click();
    await page.locator('#file-explorer a[href="/docs/guide.md"]').click();
    await expect(page).toHaveURL(/\/docs\/guide\.md$/);
    await expect(page.locator("h1")).toContainText("Guide");
  });
});
