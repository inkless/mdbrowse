import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTree } from "./render-tree.js";
import { buildTree, type TreeNode } from "./tree.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mdbrowse-tree-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function flatten(n: TreeNode): string[] {
  const out: string[] = [];
  for (const c of n.children) {
    if (c.isDir) {
      out.push(`${c.name}/ [dir]`);
      for (const gc of c.children) {
        if (gc.isDir) out.push(`${c.name}/${gc.name}/ [dir]`);
        else out.push(`${c.name}/${gc.name}`);
      }
    } else {
      out.push(c.urlPath);
    }
  }
  return out;
}

describe("buildTree", () => {
  it("filters out non-markdown files, dotfiles, and empty dirs; sorts dirs first", () => {
    writeFileSync(join(dir, "README.md"), "# r\n");
    writeFileSync(join(dir, "zzz.md"), "z\n");
    writeFileSync(join(dir, "ignored.txt"), "skip");
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs", "guide.md"), "# g\n");
    mkdirSync(join(dir, "empty"));
    writeFileSync(join(dir, "empty", "no-md.txt"), "skip");
    mkdirSync(join(dir, ".hidden"));
    writeFileSync(join(dir, ".hidden", "secret.md"), "no\n");

    const got = flatten(buildTree(dir));
    expect(got).toEqual(["docs/ [dir]", "docs/guide.md", "/README.md", "/zzz.md"]);
  });

  it("recurses into nested directories", () => {
    mkdirSync(join(dir, "a"));
    mkdirSync(join(dir, "a", "b"));
    writeFileSync(join(dir, "a", "b", "deep.md"), "# d\n");

    const tree = buildTree(dir);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0]?.name).toBe("a");
    expect(tree.children[0]?.children[0]?.name).toBe("b");
    expect(tree.children[0]?.children[0]?.children[0]?.urlPath).toBe("/a/b/deep.md");
  });
});

describe("renderTree", () => {
  it("highlights the current file and opens its containing directories", () => {
    writeFileSync(join(dir, "README.md"), "# r\n");
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, "docs", "guide.md"), "# g\n");

    const html = renderTree(buildTree(dir), "/docs/guide.md");

    expect(html).toContain("<details open><summary>docs</summary>");
    expect(html).toContain('<li class="file current"><a href="/docs/guide.md">guide.md</a></li>');
    // README is not the current file → unmarked
    expect(html).not.toContain('class="file current"><a href="/README.md"');
    expect(html).toContain('href="/README.md"');
  });

  it("returns an empty string for an empty/null tree", () => {
    expect(renderTree(null, "/")).toBe("");
    expect(renderTree({ name: "x", urlPath: "/", isDir: true, children: [] }, "/")).toBe("");
  });

  it("escapes HTML in file/dir names", () => {
    mkdirSync(join(dir, "weird & dir"));
    writeFileSync(join(dir, "weird & dir", "<file>.md"), "# x\n");

    const html = renderTree(buildTree(dir), "/");
    expect(html).toContain("weird &amp; dir");
    expect(html).toContain("&lt;file&gt;.md");
  });
});
