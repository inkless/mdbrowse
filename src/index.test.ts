import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("index", () => {
  it("exports a VERSION string", () => {
    expect(typeof VERSION).toBe("string");
  });
});
