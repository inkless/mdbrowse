import { readdirSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";

export interface TreeNode {
  name: string;
  urlPath: string;
  isDir: boolean;
  children: TreeNode[];
}

const MD_EXT = /\.(md|markdown)$/i;

/**
 * Walk a directory and build a tree of markdown files. Hidden entries
 * (`.foo`) are skipped. Directories are kept only when they recursively
 * contain at least one markdown file. Children are sorted: directories
 * first (case-insensitive alpha), then files (same).
 *
 * URL paths use forward slashes regardless of platform — they're for the
 * browser's `<a href>` attribute, not the filesystem.
 */
export function buildTree(root: string): TreeNode {
  return buildNode(root, "");
}

function buildNode(absPath: string, relUrlPath: string): TreeNode {
  const info = statSync(absPath);

  const node: TreeNode = {
    name: basename(absPath),
    urlPath: relUrlPath === "" ? "/" : `/${relUrlPath.replace(/^\/+/, "")}`,
    isDir: info.isDirectory(),
    children: [],
  };

  if (!node.isDir) return node;

  let names: string[];
  try {
    names = readdirSync(absPath);
  } catch {
    return node;
  }

  const dirs: TreeNode[] = [];
  const files: TreeNode[] = [];

  for (const name of names) {
    if (name.startsWith(".")) continue;

    const childAbs = join(absPath, name);
    const childRel = posix.join(relUrlPath, name);

    let childInfo: ReturnType<typeof statSync>;
    try {
      childInfo = statSync(childAbs);
    } catch {
      continue;
    }

    if (childInfo.isDirectory()) {
      const child = buildNode(childAbs, childRel);
      if (hasMarkdown(child)) dirs.push(child);
      continue;
    }

    if (childInfo.isFile() && MD_EXT.test(name)) {
      files.push({
        name,
        urlPath: `/${childRel.replace(/^\/+/, "")}`,
        isDir: false,
        children: [],
      });
    }
  }

  const byName = (a: TreeNode, b: TreeNode) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  dirs.sort(byName);
  files.sort(byName);
  node.children = [...dirs, ...files];
  return node;
}

function hasMarkdown(node: TreeNode): boolean {
  if (!node.isDir) return MD_EXT.test(node.name);
  return node.children.some(hasMarkdown);
}

export interface FileEntry {
  /** URL path with leading slash, e.g. `/docs/guide.md`. */
  path: string;
  /** Basename, e.g. `guide.md`. */
  name: string;
}

/**
 * Flatten a tree into a path-sorted list of markdown file entries. Used
 * by the client-side file-search modal to do fzf-style matching without a
 * round-trip to the server.
 */
export function flattenTree(root: TreeNode): FileEntry[] {
  const out: FileEntry[] = [];
  walk(root, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function walk(node: TreeNode, out: FileEntry[]): void {
  if (!node.isDir) {
    if (MD_EXT.test(node.name)) {
      out.push({ path: node.urlPath, name: node.name });
    }
    return;
  }
  for (const child of node.children) walk(child, out);
}
