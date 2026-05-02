import type { PluginWithOptions } from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

export interface GhIssueOptions {
  /**
   * `owner/repo` slug used for bare `#NNN` references. When unset, bare
   * `#NNN` is left as plain text (matching go-grip's behavior with no
   * configured repository).
   */
  repository?: string;
}

const EXTERNAL_RE = /([a-zA-Z0-9][-a-zA-Z0-9]*)\/([a-zA-Z0-9][-a-zA-Z0-9_]*)#(\d+)/g;
// Internal `#123` requires the preceding char to NOT be a word char or `/`,
// so `foo/bar#1` doesn't double-match as both external and internal.
const INTERNAL_RE = /(^|[^\w/])#(\d+)/g;

interface Match {
  start: number;
  end: number;
  external: boolean;
  owner?: string;
  repo?: string;
  number: string;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];

  EXTERNAL_RE.lastIndex = 0;
  for (let m = EXTERNAL_RE.exec(text); m !== null; m = EXTERNAL_RE.exec(text)) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      external: true,
      owner: m[1],
      repo: m[2],
      number: m[3] as string,
    });
  }

  INTERNAL_RE.lastIndex = 0;
  for (let m = INTERNAL_RE.exec(text); m !== null; m = INTERNAL_RE.exec(text)) {
    const hashPos = m.index + (m[1]?.length ?? 0);
    // Skip if this position is already inside an external match.
    if (matches.some((e) => hashPos >= e.start && hashPos < e.end)) continue;
    matches.push({
      start: hashPos,
      end: m.index + m[0].length,
      external: false,
      number: m[2] as string,
    });
  }

  matches.sort((a, b) => a.start - b.start);
  return matches;
}

function buildIssueTokens(
  state: { Token: typeof Token },
  match: Match,
  fallbackRepo: string,
): Token[] {
  let owner: string;
  let repo: string;
  let displayText: string;

  if (match.external) {
    owner = match.owner as string;
    repo = match.repo as string;
    displayText = `${owner}/${repo}#${match.number}`;
  } else {
    if (!fallbackRepo) {
      // No repo configured → leave as plain text `#NNN`.
      const text = new state.Token("text", "", 0);
      text.content = `#${match.number}`;
      return [text];
    }
    const parts = fallbackRepo.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      const text = new state.Token("text", "", 0);
      text.content = `#${match.number}`;
      return [text];
    }
    [owner, repo] = parts as [string, string];
    displayText = `#${match.number}`;
  }

  const url = `https://github.com/${owner}/${repo}/issues/${match.number}`;
  const open = new state.Token("link_open", "a", 1);
  open.attrSet("href", url);
  open.attrSet("class", "issue-link");
  const text = new state.Token("text", "", 0);
  text.content = displayText;
  const close = new state.Token("link_close", "a", -1);
  return [open, text, close];
}

/**
 * GitHub issue/PR references:
 *   - `#123` → `<a href="https://github.com/<repo>/issues/123" class="issue-link">#123</a>`
 *     (only when a `repository` is configured or auto-detected from git)
 *   - `owner/repo#123` → ditto, with `owner/repo` taken from the reference itself.
 *
 * Skipped inside `code_inline` and `link_open`/`link_close` regions.
 * Mirrors go-grip's `pkg/ghissue` exactly.
 */
export const ghIssuePlugin: PluginWithOptions<GhIssueOptions> = (md, options) => {
  const fallbackRepo = options?.repository ?? "";

  md.core.ruler.after("inline", "gh-issue", (state) => {
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;

      const newChildren: Token[] = [];
      let inLinkDepth = 0;

      for (const child of block.children) {
        if (child.type === "link_open") inLinkDepth++;
        else if (child.type === "link_close") inLinkDepth = Math.max(0, inLinkDepth - 1);

        if (child.type !== "text" || inLinkDepth > 0) {
          newChildren.push(child);
          continue;
        }

        const text = child.content;
        const matches = findMatches(text);
        if (matches.length === 0) {
          newChildren.push(child);
          continue;
        }

        let cursor = 0;
        for (const match of matches) {
          if (match.start > cursor) {
            const before = new state.Token("text", "", 0);
            before.content = text.slice(cursor, match.start);
            newChildren.push(before);
          }
          newChildren.push(...buildIssueTokens(state, match, fallbackRepo));
          cursor = match.end;
        }
        if (cursor < text.length) {
          const after = new state.Token("text", "", 0);
          after.content = text.slice(cursor);
          newChildren.push(after);
        }
      }

      block.children = newChildren;
    }
    return false;
  });
};
