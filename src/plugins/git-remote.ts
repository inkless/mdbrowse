import { execSync } from "node:child_process";

const GITHUB_REPO_RE = /github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/;

/**
 * Detect the GitHub `owner/repo` slug from `git remote get-url origin`.
 * Returns an empty string if the cwd isn't a git checkout, the remote isn't
 * a GitHub URL, or git is unavailable. Mirrors `pkg/ghissue/git.go`.
 */
export function detectGitHubRepository(cwd?: string): string {
  let raw: string;
  try {
    raw = execSync("git remote get-url origin", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
      timeout: 1500,
    }).trim();
  } catch {
    return "";
  }
  const m = GITHUB_REPO_RE.exec(raw);
  if (!m) return "";
  const owner = m[1] ?? "";
  const repo = (m[2] ?? "").replace(/\.git$/, "");
  if (!owner || !repo) return "";
  return `${owner}/${repo}`;
}
