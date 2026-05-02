import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { type ServerHandle, serveMarkdown } from "./server.js";

let dir: string;
let handle: ServerHandle;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "mdgrip-live-"));
  writeFileSync(join(dir, "README.md"), "# v1\n");
  handle = await serveMarkdown(null, {
    directory: dir,
    port: 0,
    browser: false,
    reload: true,
  });
});

afterEach(async () => {
  if (handle) await handle.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("live reload", () => {
  it("injects the client snippet when reload is enabled", async () => {
    const res = await fetch(handle.url);
    const body = await res.text();
    expect(body).toContain("__mdgrip_livereload");
    expect(body).toContain("location.reload");
  });

  it("broadcasts reload over the websocket on file change", async () => {
    const wsUrl = handle.url.replace(/^http/, "ws").replace(/README\.md$/, "");
    const ws = new WebSocket(`${wsUrl}__mdgrip_livereload`);

    await new Promise<void>((ok, fail) => {
      ws.on("open", () => ok());
      ws.on("error", fail);
    });

    const reloadPromise = new Promise<string>((ok) => {
      ws.on("message", (data) => ok(data.toString()));
    });

    // Give chokidar's awaitWriteFinish a chance to settle, then write.
    await new Promise((r) => setTimeout(r, 100));
    writeFileSync(join(dir, "README.md"), "# v2\n");

    const message = await Promise.race([
      reloadPromise,
      new Promise<string>((_, fail) =>
        setTimeout(() => fail(new Error("timeout waiting for reload")), 5000),
      ),
    ]);

    expect(message).toBe("reload");
    ws.close();
  }, 10_000);
});

describe("live reload disabled", () => {
  it("does not inject the snippet when reload:false", async () => {
    await handle.close();
    handle = await serveMarkdown(null, {
      directory: dir,
      port: 0,
      browser: false,
      reload: false,
    });
    const res = await fetch(handle.url);
    const body = await res.text();
    expect(body).not.toContain("__mdgrip_livereload");
  });
});
