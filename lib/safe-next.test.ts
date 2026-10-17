import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeNext("/join/abc")).toBe("/join/abc");
    expect(safeNext("/team?firm=1")).toBe("/team?firm=1");
  });

  it("falls back for missing, external or protocol-relative destinations", () => {
    for (const bad of [null, undefined, "", "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "javascript:alert(1)", "/\t/evil.com"]) {
      expect(safeNext(bad)).toBe("/companies");
    }
    expect(safeNext("//evil.com", "/team")).toBe("/team");
  });
});
