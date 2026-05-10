import { readdirSync, statSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { isCodeFile } from "./code.js";

export interface TreeNode {
  name: string;
  urlPath: string;
  isDir: boolean;
  children: TreeNode[];
}

const MD_EXT = /\.(md|markdown)$/i;

/**
 * Conventional build / dependency / cache directories that almost no
 * one wants in the sidebar or `Cmd+K` search. Skipped by default;
 * pass `{ all: true }` to disable.
 */
export const DEFAULT_IGNORED_DIRS: ReadonlySet<string> = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  "target",
  "coverage",
  "vendor",
]);

export interface BuildTreeOptions {
  /**
   * Disable both the dotfile filter and the `DEFAULT_IGNORED_DIRS`
   * filter — show every directory regardless of name. Off by default.
   */
  all?: boolean;
  /**
   * Also list recognized source/config files (TS/JS/Python/Go/JSON/...) in
   * the sidebar + `Cmd+K` search. The set of recognized extensions matches
   * `code.ts`'s language map. Off by default — markdown-only sidebars stay
   * uncluttered.
   */
  code?: boolean;
}

/**
 * Walk a directory and build a tree of files. By default only markdown
 * files (`.md`/`.markdown`) are listed; with `code: true`, recognized
 * source/config files are listed too. Hidden entries (`.foo`) and
 * conventional build/dep dirs (`DEFAULT_IGNORED_DIRS`) are skipped unless
 * `all: true`. Directories are kept only when they recursively contain at
 * least one listed file. Children are sorted: directories first
 * (case-insensitive alpha), then files (same).
 *
 * URL paths use forward slashes regardless of platform — they're for the
 * browser's `<a href>` attribute, not the filesystem.
 */
export function buildTree(root: string, opts: BuildTreeOptions = {}): TreeNode {
  return buildNode(root, "", opts.all ?? false, opts.code ?? false);
}

function buildNode(absPath: string, relUrlPath: string, all: boolean, code: boolean): TreeNode {
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
    if (!all) {
      if (name.startsWith(".")) continue;
      if (DEFAULT_IGNORED_DIRS.has(name)) continue;
    }

    const childAbs = join(absPath, name);
    const childRel = posix.join(relUrlPath, name);

    let childInfo: ReturnType<typeof statSync>;
    try {
      childInfo = statSync(childAbs);
    } catch {
      continue;
    }

    if (childInfo.isDirectory()) {
      const child = buildNode(childAbs, childRel, all, code);
      if (hasListedFile(child, code)) dirs.push(child);
      continue;
    }

    if (childInfo.isFile() && isListedFile(name, code)) {
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

function isListedFile(name: string, code: boolean): boolean {
  if (MD_EXT.test(name)) return true;
  if (code && isCodeFile(name)) return true;
  return false;
}

function hasListedFile(node: TreeNode, code: boolean): boolean {
  if (!node.isDir) return isListedFile(node.name, code);
  return node.children.some((c) => hasListedFile(c, code));
}

export interface FileEntry {
  /** URL path with leading slash, e.g. `/docs/guide.md`. */
  path: string;
  /** Basename, e.g. `guide.md`. */
  name: string;
}

/**
 * Flatten a tree into a path-sorted list of file entries. Used by the
 * client-side file-search modal to do fzf-style matching without a
 * round-trip to the server. Includes every file present in the tree —
 * whichever extensions made it through `buildTree`'s filter end up here.
 */
export function flattenTree(root: TreeNode): FileEntry[] {
  const out: FileEntry[] = [];
  walk(root, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function walk(node: TreeNode, out: FileEntry[]): void {
  if (!node.isDir) {
    out.push({ path: node.urlPath, name: node.name });
    return;
  }
  for (const child of node.children) walk(child, out);
}
