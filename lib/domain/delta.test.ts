import { describe, expect, it } from "vitest";
import { moneyDelta, multipleDelta } from "./delta";

describe("KPI deltas", () => {
  it("prints and judges money moves", () => {
    expect(moneyDelta(48, 90)).toEqual({ change: -42, display: "−$42.0M", direction: "down", good: false });
    expect(moneyDelta(96, 90)).toMatchObject({ display: "+$6.0M", direction: "up", good: true });
  });

  it("treats moves under $50K as flat and unjudged", () => {
    expect(moneyDelta(90.04, 90)).toEqual({ change: expect.closeTo(0.04, 9), display: "–", direction: "flat", good: null });
  });

  it("reports but doesn't judge when there's no better direction", () => {
    expect(moneyDelta(48, 6, null)).toMatchObject({ display: "+$42.0M", good: null, direction: "up" });
  });

  it("handles multiples, where lower can be better, and missing values", () => {
    expect(multipleDelta(3.1, 25, true)).toMatchObject({ display: "−21.9x", good: false });
    expect(multipleDelta(4, 0.5, false)).toMatchObject({ display: "+3.5x", good: false });
    expect(multipleDelta(null, 2, true)).toBeNull();
  });
});
