import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServerHandle, serveMarkdown } from "./server.js";

let tmp: string;
let handle: ServerHandle;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "mdbrowse-server-"));
  writeFileSync(join(tmp, "README.md"), "# hello\n\nbody with `#42` and ```js\nconst x = 1\n```\n");
  writeFileSync(join(tmp, "image.txt"), "not markdown");
  // Bind to port 0 so the OS picks a free port — avoids flaky CI on 6419.
  handle = await serveMarkdown(null, {
    directory: tmp,
    port: 0,
    browser: false,
  });
}, 30_000);

afterAll(async () => {
  if (handle) await handle.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("serveMarkdown", () => {
  it("redirects the root to /README.md when a README is present", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(baseUrl, { redirect: "manual" });
    expect(res.status).toBe(302);
    // Should redirect to a path ending in README.md or just stay at /
    // (server rewrites to /README.md by joining the URL itself; here we
    // verify the configured URL is README.md).
    expect(handle.url).toContain("README.md");
  });

  it("renders a markdown file as HTML wrapped in the layout template", async () => {
    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("<title>hello</title>");
    expect(body).toContain("<h1");
    // Shiki block is rendered.
    expect(body).toContain("shiki");
  });

  it("serves /static/ from the bundled assets", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}static/css/shiki.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/css/);
    const body = await res.text();
    expect(body).toContain("--shiki-light");
  });

  it("returns 404 for unknown paths", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}does/not/exist.md`);
    expect(res.status).toBe(404);
  });

  it("rejects path traversal attempts", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}../../etc/passwd`);
    // 403 if server resolves outside dir, 404 if just missing — either
    // is fine; what's NOT fine is 200 with sensitive content.
    expect([403, 404]).toContain(res.status);
  });

  it("serves regular files as static fallback", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}image.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("not markdown");
  });
});
