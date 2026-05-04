import { expect, test } from "@playwright/test";

// Below the 940px breakpoint, body has padding-top: 56px so the four
// fixed toolbar buttons (hamburger, search, width, theme) don't overlap
// the page H1. Regression test for the bug shown in the
// `atom-checkout-funnel — Tracker` screenshot.
test.describe("mobile toolbar layout", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("toolbar buttons sit cleanly above the H1, no overlap", async ({ page }) => {
    await page.goto("/README.md");

    const buttonSelectors = [
      "#explorer-toggle",
      "#search-toggle",
      "#width-toggle",
      "#theme-toggle",
    ];

    let maxButtonBottom = 0;
    for (const sel of buttonSelectors) {
      const box = await page.locator(sel).boundingBox();
      expect(box).not.toBeNull();
      if (box) maxButtonBottom = Math.max(maxButtonBottom, box.y + box.height);
    }

    const h1 = await page.locator("h1#sample-project").boundingBox();
    expect(h1).not.toBeNull();
    if (!h1) return;

    // The H1 must start strictly below the bottom edge of the lowest
    // toolbar button. With 56px body padding-top + 32px-tall buttons at
    // top: 20px, button bottom = 52, H1 top should be ≥ 56.
    expect(h1.y).toBeGreaterThanOrEqual(maxButtonBottom);
  });
});
