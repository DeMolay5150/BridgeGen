import { describe, expect, it } from "vitest";
import { amortize, irr, npv, pmt, wacc, xirr, xnpv } from "./index";

// Reference values are Excel's, computed by hand where noted.
describe("npv", () => {
  it("leaves t = 0 undiscounted", () => {
    expect(npv(0.1, [-100, 60, 60])).toBeCloseTo(-100 + 60 / 1.1 + 60 / 1.21, 10);
  });

  it("matches Excel NPV() when a zero is prepended", () => {
    // Excel: =NPV(10%, 100, 100) = 173.5537
    expect(npv(0.1, [0, 100, 100])).toBeCloseTo(173.5537, 4);
  });
});

describe("irr", () => {
  it("matches Excel IRR()", () => {
    // Excel: =IRR({-100, 39, 59, 55, 20}) = 28.09%
    expect(irr([-100, 39, 59, 55, 20])).toBeCloseTo(0.2809484, 6);
  });

  it("solves a 2x money multiple over 5 years", () => {
    expect(irr([-100, 0, 0, 0, 0, 200])).toBeCloseTo(2 ** (1 / 5) - 1, 9);
  });

  it("finds negative returns", () => {
    expect(irr([-100, 50])).toBeCloseTo(-0.5, 9);
  });

  it("returns null when flows never change sign", () => {
    expect(irr([100, 50])).toBeNull();
    expect(irr([-100, -50])).toBeNull();
  });
});

describe("xirr", () => {
  it("matches Excel's documented XIRR example", () => {
    // Microsoft's XIRR help example: 0.373362535
    const flows = [
      { amount: -10000, date: new Date("2008-01-01") },
      { amount: 2750, date: new Date("2008-03-01") },
      { amount: 4250, date: new Date("2008-10-30") },
      { amount: 3250, date: new Date("2009-02-15") },
      { amount: 2750, date: new Date("2009-04-01") },
    ];
    expect(xirr(flows)).toBeCloseTo(0.373362535, 6);
    expect(xnpv(xirr(flows)!, flows)).toBeCloseTo(0, 6);
  });

  it("returns null without a sign change", () => {
    expect(xirr([{ amount: 1, date: new Date("2026-01-01") }])).toBeNull();
  });
});

describe("wacc", () => {
  it("weights after-tax debt and equity by value", () => {
    // 60/40 split, 12% equity, 8% debt, 25% tax: 0.6×12% + 0.4×8%×0.75 = 9.6%
    expect(wacc({ equity: 60, debt: 40, costOfEquity: 0.12, costOfDebt: 0.08, taxRate: 0.25 })).toBeCloseTo(0.096, 12);
  });

  it("is the cost of equity for an unlevered company and null with no capital", () => {
    expect(wacc({ equity: 50, debt: 0, costOfEquity: 0.12, costOfDebt: 0.08, taxRate: 0.25 })).toBeCloseTo(0.12, 12);
    expect(wacc({ equity: 0, debt: 0, costOfEquity: 0.12, costOfDebt: 0.08, taxRate: 0.25 })).toBeNull();
  });
});

describe("pmt and amortize", () => {
  it("matches Excel PMT()", () => {
    // Excel: =-PMT(8%, 5, 100) = 25.0456
    expect(pmt(0.08, 5, 100)).toBeCloseTo(25.0456, 4);
    expect(pmt(0, 4, 100)).toBe(25);
  });

  it("repays exactly, for every style", () => {
    for (const style of ["level", "straightLine", "bullet"] as const) {
      const rows = amortize(100, 0.08, 5, style);
      expect(rows).toHaveLength(5);
      expect(rows.at(-1)!.closingBalance).toBeCloseTo(0, 9);
      expect(rows.reduce((s, r) => s + r.principal, 0)).toBeCloseTo(100, 9);
      rows.forEach((r) => expect(r.interest).toBeCloseTo(r.openingBalance * 0.08, 9));
    }
  });

  it("levels payments, levels principal, or defers it to maturity", () => {
    expect(amortize(100, 0.08, 5, "level").every((r) => Math.abs(r.payment - 25.0456) < 1e-4)).toBe(true);
    expect(amortize(100, 0.08, 5, "straightLine").every((r) => r.principal === 20)).toBe(true);
    const bullet = amortize(100, 0.08, 5, "bullet");
    expect(bullet.slice(0, 4).every((r) => r.principal === 0 && r.payment === 8)).toBe(true);
    expect(bullet[4].payment).toBeCloseTo(108, 9);
  });
});
