import { describe, expect, it } from "vitest";
import { COMPARISON, PLANS } from "./plans";
import { computeRoi } from "./roi";

describe("plans", () => {
  it("prices match PRICING.md and sit inside the agreed ranges", () => {
    const byId = Object.fromEntries(PLANS.map((p) => [p.id, p]));
    expect(byId.solo).toMatchObject({ monthly: 249, annual: 2_490 });
    expect(byId.firm).toMatchObject({ monthly: 699, annual: 6_990 });
    expect(byId.enterprise).toMatchObject({ monthly: null, annual: 24_000, isFromPrice: true });
    expect(byId.solo.monthly).toBeGreaterThanOrEqual(199);
    expect(byId.solo.monthly).toBeLessThanOrEqual(299);
    expect(byId.firm.monthly).toBeGreaterThanOrEqual(499);
    expect(byId.firm.monthly).toBeLessThanOrEqual(899);
    expect(byId.enterprise.annual).toBeGreaterThanOrEqual(15_000);
    expect(byId.enterprise.annual).toBeLessThanOrEqual(35_000);
  });

  it("gives two months free on annual billing", () => {
    for (const plan of PLANS.filter((p) => p.monthly !== null)) {
      expect(plan.annual).toBe(plan.monthly! * 10);
    }
  });

  it("marks unbuilt capabilities as coming soon, never as included", () => {
    const row = (name: string) => COMPARISON.find((r) => r.capability.startsWith(name))!.cells;
    expect(row("Shared firm workspace").firm).toBe("coming-soon");
    expect(row("White-label").enterprise).toBe("coming-soon");
    expect(row("SSO").enterprise).toBe("coming-soon");
    const firmFeatures = PLANS.find((p) => p.id === "firm")!.features;
    expect(firmFeatures.find((f) => f.text.startsWith("Shared firm workspace"))?.status).toBe("coming-soon");
  });
});

// Hand-checked against PRICING.md Section 7.2.
describe("computeRoi", () => {
  it("shows one $25,000 engagement paying back Solo about ten times", () => {
    const r = computeRoi({ feePerEngagement: 25_000, extraEngagements: 1, plan: "solo" });
    expect(r.annualPrice).toBe(2_490);
    expect(r.returnMultiple).toBeCloseTo(10.04, 2);
    expect(r.breakEvenEngagements).toBeCloseTo(0.0996, 4);
  });

  it("shows Firm at about 3.6x for one engagement and 7.2x for two", () => {
    expect(computeRoi({ feePerEngagement: 25_000, extraEngagements: 1, plan: "firm" }).returnMultiple).toBeCloseTo(3.58, 2);
    expect(computeRoi({ feePerEngagement: 25_000, extraEngagements: 2, plan: "firm" }).returnMultiple).toBeCloseTo(7.15, 2);
  });

  it("returns null multiples rather than dividing by zero", () => {
    expect(computeRoi({ feePerEngagement: 0, extraEngagements: 3, plan: "solo" })).toMatchObject({
      annualUpside: 0,
      returnMultiple: null,
      breakEvenEngagements: null,
    });
    expect(computeRoi({ feePerEngagement: 25_000, extraEngagements: 0, plan: "solo" }).returnMultiple).toBeNull();
  });

  it("clamps hostile inputs", () => {
    for (const x of [Number.NaN, -1, -Infinity, Infinity, 1e15]) {
      const r = computeRoi({ feePerEngagement: x, extraEngagements: x, plan: "enterprise" });
      expect([r.annualUpside, r.returnMultiple ?? 0, r.breakEvenEngagements ?? 0].every(Number.isFinite)).toBe(true);
      expect(r.annualUpside).toBeGreaterThanOrEqual(0);
    }
  });
});
