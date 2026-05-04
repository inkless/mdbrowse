import { expect, type Page, test } from "@playwright/test";

// We don't use clipboard.readText() — that triggers a permission prompt
// which is fragile in CI. Instead we replace navigator.clipboard with a
// tracker before each navigation; the recorded writes are read back via
// page.evaluate after the click. globalThis casts keep the test source
// free of DOM type references (tsconfig.lib doesn't include DOM).
async function installClipboardSpy(page: Page) {
  await page.addInitScript(() => {
    const g = globalThis as unknown as {
      __clipboardWrites: string[];
      navigator: { clipboard?: unknown };
    };
    g.__clipboardWrites = [];
    Object.defineProperty(g.navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          g.__clipboardWrites.push(text);
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  });
}

async function readClipboardWrites(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (globalThis as unknown as { __clipboardWrites: string[] }).__clipboardWrites,
  );
}

test.describe("copy markdown source button", () => {
  test("button exists on a real .md page and copies the source on click", async ({ page }) => {
    await installClipboardSpy(page);
    await page.goto("/README.md");

    const button = page.locator("#copy-source-toggle");
    await expect(button).toBeVisible();

    await button.click();

    // Visual feedback: is-copied class added, icon flips to ✓.
    await expect(button).toHaveClass(/is-copied/);
    await expect(button.locator(".copy-source-toggle-icon")).toHaveText("✓");

    // Clipboard got the raw source.
    const writes = await readClipboardWrites(page);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toContain("# Sample Project");
    expect(writes[0]).toContain("export function greet");
  });

  test("button is hidden on a synthetic directory listing", async ({ page }) => {
    await page.goto("/runbooks/");
    await expect(page.locator("#copy-source-toggle")).toHaveCount(0);
    await expect(page.locator("#mdbrowse-source")).toHaveCount(0);
  });
});

test.describe("copy code button on shiki blocks", () => {
  test("auto-injects exactly one button per shiki <pre>", async ({ page }) => {
    await page.goto("/README.md");
    const pres = page.locator(".markdown-body pre.shiki");
    const buttons = page.locator(".markdown-body pre.shiki .code-copy");
    const preCount = await pres.count();
    expect(preCount).toBeGreaterThan(0);
    await expect(buttons).toHaveCount(preCount);
  });

  test("clicking the button copies the <code> textContent", async ({ page }) => {
    await installClipboardSpy(page);
    await page.goto("/README.md");

    const firstPre = page.locator(".markdown-body pre.shiki").first();
    const expected = await firstPre.locator("code").textContent();
    expect(expected).toBeTruthy();

    await firstPre.locator(".code-copy").click();

    const writes = await readClipboardWrites(page);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toBe(expected);
  });

  test("button shows feedback after click", async ({ page }) => {
    await installClipboardSpy(page);
    await page.goto("/README.md");
    const button = page.locator(".markdown-body pre.shiki").first().locator(".code-copy");
    await button.click();
    await expect(button).toHaveClass(/is-copied/);
    await expect(button.locator(".code-copy-icon")).toHaveText("✓");
  });
});
