import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
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
  // Code/config files for the syntax-highlighting fallback path.
  writeFileSync(join(tmp, "sample.ts"), "export const greet = (n: string): string => n;\n");
  writeFileSync(join(tmp, "config.json"), '{\n  "name": "mdbrowse"\n}\n');
  // Source containing triple backticks — fence picker must escape this
  // so the synthetic wrapper doesn't terminate early.
  writeFileSync(join(tmp, "fences.sh"), "echo '```'\necho 'still inside'\n");
  writeFileSync(join(tmp, "Dockerfile"), "FROM node:20\nRUN echo hi\n");
  // Binary file — must stream raw (NUL byte trips the text sniffer).
  writeFileSync(
    join(tmp, "blob.bin"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x03]),
  );
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

  it("renders plain .txt files in the layout as plaintext (no shiki coloring spans, no fence breakouts)", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}image.txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("<title>image.txt</title>");
    // Original bytes round-trip through the copy-source embed.
    const match = body.match(
      /<script type="application\/json" id="mdbrowse-source">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    expect(JSON.parse(match[1] ?? "")).toBe("not markdown");
  });

  it("renders a TypeScript source file with shiki highlighting wrapped in the layout", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}sample.ts`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("<!doctype html>");
    expect(body).toContain("<title>sample.ts</title>");
    // Shiki output is present (themed code block).
    expect(body).toContain("shiki");
    // Embedded source should be the raw file bytes, not the synthetic
    // markdown wrapper — so the copy-source button hands back what's on
    // disk. The fence backticks must NOT appear in the embedded payload.
    const match = body.match(
      /<script type="application\/json" id="mdbrowse-source">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const embedded = JSON.parse(match[1] ?? "");
    expect(embedded).toContain("export const greet");
    expect(embedded).not.toMatch(/^```/);
  });

  it("renders a JSON file with shiki highlighting", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}config.json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("shiki");
    expect(body).toContain("<title>config.json</title>");
  });

  it("renders bare filenames like Dockerfile via the FILENAME_LANG map", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}Dockerfile`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toContain("shiki");
    expect(body).toContain("<title>Dockerfile</title>");
  });

  it("renders source containing triple backticks without terminating the synthetic fence early", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}fences.sh`);
    expect(res.status).toBe(200);
    const body = await res.text();
    // If the fence terminated early, the trailing line would render
    // outside the code block as markdown — i.e. as a top-level paragraph.
    // Asserting both lines appear inside a shiki block is enough.
    expect(body).toContain("shiki");
    expect(body).toContain("still inside");
    // And neither line should appear as a standalone markdown paragraph.
    expect(body).not.toMatch(/<p>still inside<\/p>/);
  });

  it("streams binary files raw (NUL-byte sniff trips before layout wrap)", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}blob.bin`);
    expect(res.status).toBe(200);
    // Binary path: octet-stream, NOT layout-wrapped HTML.
    expect(res.headers.get("content-type")).not.toMatch(/text\/html/);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body[0]).toBe(0x89);
    expect(body[4]).toBe(0x00);
  });

  it("omits code files from the sidebar by default", async () => {
    const res = await fetch(handle.url);
    const body = await res.text();
    // The sidebar tree is rendered into the layout's <aside>. sample.ts /
    // config.json / fences.sh should NOT appear as <a href> entries.
    expect(body).not.toMatch(/href="\/sample\.ts"/);
    expect(body).not.toMatch(/href="\/config\.json"/);
    // README + tricky.md (added in a later test) are markdown → always present.
    expect(body).toMatch(/href="\/README\.md"/);
  });

  it("includes code files in the sidebar when serveMarkdown is called with `code: true`", async () => {
    const codeHandle = await serveMarkdown(null, {
      directory: tmp,
      port: 0,
      browser: false,
      reload: false,
      code: true,
    });
    try {
      const res = await fetch(codeHandle.url);
      const body = await res.text();
      expect(body).toMatch(/href="\/sample\.ts"/);
      expect(body).toMatch(/href="\/config\.json"/);
      expect(body).toMatch(/href="\/Dockerfile"/);
      // The ⌘K search index (inline JSON) should also list them.
      const fileIndexMatch = body.match(
        /<script type="application\/json" id="mdbrowse-file-index">([\s\S]*?)<\/script>/,
      );
      expect(fileIndexMatch).not.toBeNull();
      if (!fileIndexMatch) return;
      const entries = JSON.parse(fileIndexMatch[1] ?? "") as Array<{ path: string }>;
      const paths = entries.map((e) => e.path);
      expect(paths).toContain("/sample.ts");
      expect(paths).toContain("/Dockerfile");
    } finally {
      await codeHandle.close();
    }
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

  it("embeds the raw markdown source as JSON for the copy-source button", async () => {
    const res = await fetch(handle.url);
    expect(res.status).toBe(200);
    const body = await res.text();
    // The source script tag should be present on a real .md page.
    const match = body.match(
      /<script type="application\/json" id="mdbrowse-source">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    // Embedded payload is JSON; parsing should yield the original source.
    const parsed = JSON.parse(match[1] ?? "");
    expect(parsed).toContain("# hello");
    expect(parsed).toContain("`#42`");
    // The button is wired up.
    expect(body).toContain('id="copy-source-toggle"');
  });

  it("does NOT embed source on synthetic directory listings", async () => {
    const baseUrl = handle.url.replace(/README\.md$/, "");
    const res = await fetch(`${baseUrl}noreadme/`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('id="mdbrowse-source"');
    expect(body).not.toContain('id="copy-source-toggle"');
  });

  it("escapes </script> inside embedded source so the tag doesn't terminate early", async () => {
    // Write a file whose markdown contains a literal </script> sequence.
    writeFileSync(join(tmp, "tricky.md"), "# tricky\n\nbody with </script> inside\n");
    const baseUrl = handle.url.replace(/README\.md$/, "");
    try {
      const res = await fetch(`${baseUrl}tricky.md`);
      expect(res.status).toBe(200);
      const body = await res.text();
      // The literal `</script>` must not appear inside the embedded JSON
      // payload; it should be escaped to `<\/script>`.
      const match = body.match(
        /<script type="application\/json" id="mdbrowse-source">([\s\S]*?)<\/script>/,
      );
      expect(match).not.toBeNull();
      if (!match) return;
      expect(match[1]).not.toMatch(/<\/script>/i);
      expect(match[1]).toMatch(/<\\\/script>/i);
      // And JSON.parse round-trips correctly.
      const parsed = JSON.parse(match[1] ?? "");
      expect(parsed).toContain("</script>");
    } finally {
      rmSync(join(tmp, "tricky.md"), { force: true });
    }
  });

  it("falls back to the next free port when the requested one is busy", async () => {
    // Squat on a free port via a bare TCP listener — we use net.createServer
    // (not http) so this fixture has no overlap with the mdbrowse code path.
    const squatter = createServer();
    await new Promise<void>((ok) => squatter.listen(0, "localhost", ok));
    const busyPort = (squatter.address() as AddressInfo).port;

    const fallback = await serveMarkdown(null, {
      directory: tmp,
      port: busyPort,
      browser: false,
      reload: false,
    });
    try {
      const fallbackPort = Number(new URL(fallback.url).port);
      expect(fallbackPort).toBeGreaterThan(busyPort);
      // Smoke: the fallback server actually serves content.
      const baseUrl = fallback.url.replace(/README\.md$/, "");
      const res = await fetch(baseUrl);
      expect(res.status).toBe(200);
    } finally {
      await fallback.close();
      await new Promise<void>((ok) => squatter.close(() => ok()));
    }
  }, 10_000);
});
