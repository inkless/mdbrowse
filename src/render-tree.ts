import { escapeHtml } from "./layout.js";
import type { TreeNode } from "./tree.js";

/**
 * Render the file tree as the HTML the sidebar JS expects.
 *
 * Output shape (matches `internal/render_tree.go` byte-for-byte):
 *
 *   <ul class="file-tree-list">
 *     <li class="dir"><details[ open]><summary>NAME</summary><ul>…</ul></details></li>
 *     <li class="file[ current]"><a href="/path">NAME</a></li>
 *     …
 *   </ul>
 *
 * Directories whose subtree contains the current path are rendered with the
 * `open` attribute so the browser shows them expanded by default.
 *
 * `currentPath` should be the URL path of the file being rendered (e.g.
 * `/docs/guide.md`) so the matching link is tagged `class="file current"`.
 */
export function renderTree(root: TreeNode | null, currentPath: string): string {
  if (!root || root.children.length === 0) return "";
  let out = '<ul class="file-tree-list">';
  for (const c of root.children) out += renderNode(c, currentPath);
  out += "</ul>";
  return out;
}

function renderNode(n: TreeNode, currentPath: string): string {
  if (n.isDir) {
    const open = containsCurrent(n, currentPath) ? " open" : "";
    let s = `<li class="dir"><details${open}><summary>${escapeHtml(n.name)}</summary><ul>`;
    for (const c of n.children) s += renderNode(c, currentPath);
    s += "</ul></details></li>";
    return s;
  }
  const cls = n.urlPath === currentPath ? "file current" : "file";
  return `<li class="${cls}"><a href="${escapeHtml(n.urlPath)}">${escapeHtml(n.name)}</a></li>`;
}

function containsCurrent(n: TreeNode, currentPath: string): boolean {
  for (const c of n.children) {
    if (!c.isDir && c.urlPath === currentPath) return true;
    if (c.isDir && containsCurrent(c, currentPath)) return true;
  }
  return false;
}
