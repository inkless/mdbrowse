import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = resolve(HERE, "..", "fixtures", "docs", "guide.md");

test("page reloads when the underlying markdown file changes", async ({ page }) => {
  const original = await readFile(GUIDE_PATH, "utf8");

  try {
    await page.goto("/docs/guide.md");
    const body = page.locator(".markdown-body");
    await expect(body).toContainText("reload-sentinel-original");

    const updated = original.replace("reload-sentinel-original", "reload-sentinel-updated");
    const reloaded = page.waitForEvent("load", { timeout: 5_000 });
    await writeFile(GUIDE_PATH, updated, "utf8");
    await reloaded;

    await expect(body).toContainText("reload-sentinel-updated");
  } finally {
    await writeFile(GUIDE_PATH, original, "utf8");
  }
});
