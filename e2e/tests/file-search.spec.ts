import { expect, test } from "@playwright/test";

test.describe("file search", () => {
  test("Cmd+K opens the search dialog and lists all files when empty", async ({ page }) => {
    await page.goto("/README.md");
    await page.keyboard.press("Meta+K");

    const dialog = page.locator("dialog.mdbrowse-search");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("input")).toBeFocused();

    // Empty query → all 4 fixture markdown files in the result list.
    await expect(dialog.locator("li.mdbrowse-search__result")).toHaveCount(4);
  });

  test("typing matches against folder name (subsequence)", async ({ page }) => {
    await page.goto("/README.md");
    await page.keyboard.press("Meta+K");
    await page.keyboard.type("runb");

    // First result should be runbooks/deploy.md — only file under /runbooks/.
    const first = page.locator("dialog.mdbrowse-search li.mdbrowse-search__result").first();
    await expect(first).toHaveAttribute("data-path", "/runbooks/deploy.md");
  });

  test("Enter navigates to the selected file", async ({ page }) => {
    await page.goto("/README.md");
    await page.keyboard.press("Meta+K");
    await page.keyboard.type("runb");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/runbooks\/deploy\.md$/);
    await expect(page.locator("h1")).toContainText("Deploy runbook");
  });

  test("backdrop click closes the dialog without navigating", async ({ page }) => {
    await page.goto("/README.md");
    const dialog = page.locator("dialog.mdbrowse-search");
    await page.keyboard.press("Meta+K");
    await expect(dialog).toBeVisible();

    // Element.click() dispatches a click event on the dialog itself
    // with event.target === dialog — exactly the backdrop-click shape
    // our close handler keys off. Avoids coordinate-hunting around the
    // dialog content box.
    await dialog.evaluate((d) => d.click());
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/README\.md$/);
  });

  test("clicking inside the dialog content does NOT close it", async ({ page }) => {
    await page.goto("/README.md");
    const dialog = page.locator("dialog.mdbrowse-search");
    await page.keyboard.press("Meta+K");
    await expect(dialog).toBeVisible();

    await dialog.locator(".mdbrowse-search__input").click();
    await expect(dialog).toBeVisible();
  });

  test("Escape closes the dialog without navigating", async ({ page }) => {
    await page.goto("/README.md");
    const dialog = page.locator("dialog.mdbrowse-search");
    await page.keyboard.press("Meta+K");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/README\.md$/);
  });

  test("ArrowDown moves selection and Enter follows it", async ({ page }) => {
    await page.goto("/README.md");
    await page.keyboard.press("Meta+K");

    // Move from the default first selection to the second result.
    await page.keyboard.press("ArrowDown");
    const selected = page.locator(
      'dialog.mdbrowse-search li.mdbrowse-search__result[aria-selected="true"]',
    );
    const path = await selected.getAttribute("data-path");
    expect(path).toBeTruthy();
    if (!path) throw new Error("missing data-path");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\./g, "\\.")}$`));
  });
});
