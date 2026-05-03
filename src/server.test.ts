import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  // Subdir with README.md — directory request with trailing slash should
  // serve this file (no redirect loop, no 404).
  mkdirSync(join(tmp, "withreadme"));
  writeFileSync(join(tmp, "withreadme", "README.md"), "# inner\n");
  // Subdir without any README.md — should 404, not loop.
  mkdirSync(join(tmp, "noreadme"));
  writeFileSync(join(tmp, "noreadme", "guide.md"), "# guide\n");
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
  it("serves the root README.md when fetching `/`", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(baseUrl, { redirect: "manual" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("<title>hello</title>");
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

  it("serves a subdirectory's README.md when requested with a trailing slash", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}withreadme/`, { redirect: "manual" });
    // Critical: no redirect (would loop forever), 200 with the inner
    // README.md rendered as HTML.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("<title>inner</title>");
  });

  it("redirects a directory without trailing slash to canonical /dir/ form", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}withreadme`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/withreadme/");
  });

  it("renders a directory listing when the directory has no README.md", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}noreadme/`, { redirect: "manual" });
    // Critical: not a redirect (would loop) and not a 404 dead-end.
    // We render a synthetic markdown page that links to the contents.
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    // Listing should include a link to `guide.md` so the user can drill in.
    expect(body).toMatch(/href="guide\.md"/);
  });
});
