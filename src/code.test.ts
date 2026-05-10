import { describe, expect, it } from "vitest";
import { detectCodeLanguage, wrapAsFencedMarkdown } from "./code.js";

describe("detectCodeLanguage", () => {
  it("maps common extensions to shiki language ids", () => {
    expect(detectCodeLanguage("src/server.ts")).toBe("typescript");
    expect(detectCodeLanguage("foo/bar.tsx")).toBe("tsx");
    expect(detectCodeLanguage("scripts/build.js")).toBe("javascript");
    expect(detectCodeLanguage("config.json")).toBe("json");
    expect(detectCodeLanguage("pyproject.toml")).toBe("toml");
    expect(detectCodeLanguage("app.py")).toBe("python");
    expect(detectCodeLanguage("main.go")).toBe("go");
  });

  it("matches by bare filename for Dockerfile and Makefile", () => {
    expect(detectCodeLanguage("/repo/Dockerfile")).toBe("dockerfile");
    expect(detectCodeLanguage("Makefile")).toBe("makefile");
  });

  it("returns null for files browsers should render natively (.html, .svg)", () => {
    expect(detectCodeLanguage("index.html")).toBeNull();
    expect(detectCodeLanguage("icon.svg")).toBeNull();
  });

  it("returns null for unknown extensions and binary-ish files", () => {
    expect(detectCodeLanguage("photo.png")).toBeNull();
    expect(detectCodeLanguage("notes.txt")).toBeNull();
    expect(detectCodeLanguage("README")).toBeNull();
  });

  it("is case-insensitive on the extension", () => {
    expect(detectCodeLanguage("Module.TS")).toBe("typescript");
  });
});

describe("wrapAsFencedMarkdown", () => {
  it("uses a 3-backtick fence for plain source", () => {
    const out = wrapAsFencedMarkdown("const x = 1;\n", "typescript");
    expect(out).toBe("```typescript\nconst x = 1;\n```\n");
  });

  it("appends a trailing newline when the source lacks one", () => {
    const out = wrapAsFencedMarkdown("no newline", "bash");
    expect(out).toBe("```bash\nno newline\n```\n");
  });

  it("uses a longer fence when the source contains triple backticks", () => {
    const src = "before\n```\ninside\n```\nafter\n";
    const out = wrapAsFencedMarkdown(src, "markdown");
    // 4 backticks — one more than the longest run in `src`.
    expect(out.startsWith("````markdown\n")).toBe(true);
    expect(out.endsWith("````\n")).toBe(true);
    // The original triple-backtick run must survive unchanged inside.
    expect(out).toContain("```\ninside\n```");
  });

  it("scales the fence to the longest backtick run in the source", () => {
    const src = "a\n`````\nfive\n`````\nb\n";
    const out = wrapAsFencedMarkdown(src, "text");
    expect(out.startsWith("``````text\n")).toBe(true);
  });
});
