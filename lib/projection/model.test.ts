import { describe, expect, it } from "vitest";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import type { Baseline, Scenario } from "../simulator/types";
import { resolveBranch } from "./branches";
import { DEFAULT_ASSUMPTIONS, annualDisruptionProbability, project } from "./model";
import type { ProjectionAssumptions, YearPoint } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const run = (
  scenario: Partial<Scenario> = {},
  governance = 0,
  assumptions: Partial<ProjectionAssumptions> = {},
  baseline: Partial<Baseline> = {},
) =>
  project({ ...base, ...baseline }, { ...neutral, ...scenario }, governance, {
    ...DEFAULT_ASSUMPTIONS,
    ...assumptions,
  });

// Expected values are hand-calculated from the rules in model.ts.
describe("project: demo company, today", () => {
  const years = run({}, 78);

  it("returns years 0 through 10", () => {
    expect(years.map((y) => y.year)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("starts from the day-0 simulation", () => {
    expect(years[0]).toMatchObject({ ebitda: 12, debt: 6, enterpriseValue: 96, equityValue: 90, cumulativeCash: 0 });
    expect(years[0].expectedGovernanceLoss).toBe(0);
    expect(years[0].shareholderValue).toBe(90);
  });

  it("pays down debt from year-1 free cash flow", () => {
    const y1 = years[1];
    expect(y1.ebitda).toBeCloseTo(12.48);
    expect(y1.interest).toBeCloseTo(0.48);
    expect(y1.freeCashFlow).toBeCloseTo(5.76); // 12.48 × 50% − 0.48
    expect(y1.debtPaydown).toBeCloseTo(5.76);
    expect(y1.debt).toBeCloseTo(0.24);
    expect(y1.dividends).toBe(0);
    expect(y1.disruptionProbability).toBeCloseTo(0.0624);
    expect(y1.expectedGovernanceLoss).toBeCloseTo(1.86896, 4); // 99.84 × 30% × 6.24%
    expect(y1.shareholderValue).toBeCloseTo(97.73104, 4);
  });

  it("clears the debt in year 2 and pays out the rest", () => {
    const y2 = years[2];
    expect(y2.debtPaydown).toBeCloseTo(0.24);
    expect(y2.dividends).toBeCloseTo(6.2304);
    expect(y2.debt).toBeCloseTo(0);
    expect(y2.interestCoverage).toBeCloseTo(12.9792 / 0.0192);
  });

  it("compounds growth and governance risk to year 10", () => {
    const y10 = years[10];
    expect(y10.ebitda).toBeCloseTo(12 * 1.04 ** 10);
    expect(y10.disruptionProbability).toBeCloseTo(1 - 0.9376 ** 10);
    expect(y10.disruptionProbability).toBeCloseTo(0.475, 3);
    expect(y10.interestCoverage).toBeNull();
  });
});

describe("project: mechanics", () => {
  it("never lets debt go negative", () => {
    for (const y of run({ leverage: 0.25 }, 0, { cashConversion: 0.9 })) {
      expect(y.debt).toBeGreaterThanOrEqual(0);
    }
  });

  it("borrows to cover negative free cash flow", () => {
    const [y0, y1] = run({ leverage: 6 }, 0, { cashConversion: 0.1 });
    expect(y0.debt).toBe(72);
    expect(y1.freeCashFlow).toBeCloseTo(1.248 - 5.76);
    expect(y1.debt).toBeCloseTo(76.512);
    expect(y1.flags.debtGrowing).toBe(true);
    // Coverage is EBITDA-based: 12.48 / 5.76 = 2.17x, just above the 2x threshold.
    expect(y1.interestCoverage).toBeCloseTo(12.48 / 5.76);
    expect(y1.flags.thinCoverage).toBe(false);
  });

  it("flags thin coverage once EBITDA no longer covers interest twice", () => {
    const years = run({ leverage: 6 }, 0, { ebitdaGrowth: -0.1, cashConversion: 0.1 });
    const firstThin = years.find((y) => y.flags.thinCoverage);
    expect(firstThin).toBeDefined();
    expect(firstThin!.interestCoverage!).toBeLessThan(2);
  });

  it("keeps a loss-making business flat instead of compounding losses", () => {
    const years = run({}, 0, { ebitdaGrowth: 0.15 }, { ebitda: -2 });
    expect(years[10].ebitda).toBe(-2);
    expect(years[10].enterpriseValue).toBe(0);
    expect(years[10].flags.underwater).toBe(true);
  });

  it("leaves day-0 shareholder value unchanged by leverage alone", () => {
    for (const leverage of [0, 1, 3, 6]) {
      expect(run({ leverage })[0].shareholderValue).toBeCloseTo(90);
    }
  });

  it("makes a dividend recap cost value over time through interest", () => {
    const today = run();
    const recap = run({ leverage: 3 });
    expect(recap[10].shareholderValue).toBeLessThan(today[10].shareholderValue);
  });

  it("splits shareholder value by post-transfer ownership", () => {
    const y5 = run({ equityTransfer: 0.5 })[5];
    expect(y5.founderWealth).toBeCloseTo(0.4 * y5.shareholderValue);
    expect(y5.nextGenWealth).toBeCloseTo(0.4 * y5.shareholderValue);
  });
});

describe("governance risk", () => {
  it("scales the annual disruption probability with the score", () => {
    expect(annualDisruptionProbability(0)).toBe(0);
    expect(annualDisruptionProbability(78)).toBeCloseTo(0.0624);
    expect(annualDisruptionProbability(100)).toBeCloseTo(0.08);
    expect(annualDisruptionProbability(500)).toBeCloseTo(0.08);
  });

  it("removes expected governance loss when governance is fixed", () => {
    const fixed = resolveBranch({ source: "today", fixGovernance: true }, { baseline: base, scenario: neutral, governanceScore: 78 });
    expect(fixed.governanceScore).toBe(0);
    for (const y of project(base, fixed.scenario, fixed.governanceScore, DEFAULT_ASSUMPTIONS)) {
      expect(y.expectedGovernanceLoss).toBe(0);
    }
  });

  it("makes fixing governance pay off more as the horizon lengthens", () => {
    const asIs = run({}, 78);
    const fixed = run({}, 0);
    const gap = (year: number) => fixed[year].shareholderValue - asIs[year].shareholderValue;
    expect(gap(1)).toBeGreaterThan(0);
    expect(gap(10)).toBeGreaterThan(gap(5));
    expect(gap(5)).toBeGreaterThan(gap(1));
  });
});

describe("resolveBranch", () => {
  const context = { baseline: base, scenario: { ...neutral, leverage: 2 }, governanceScore: 78 };

  it("resolves today, the live scenario and presets", () => {
    expect(resolveBranch({ source: "today", fixGovernance: false }, context).scenario).toEqual(neutral);
    expect(resolveBranch({ source: "current", fixGovernance: false }, context).scenario.leverage).toBe(2);
    expect(resolveBranch({ source: "dividend-recap", fixGovernance: false }, context).scenario.leverage).toBe(3);
  });

  it("labels fixed-governance branches and falls back to today for unknown sources", () => {
    expect(resolveBranch({ source: "full-handoff", fixGovernance: true }, context).label).toBe(
      "Full heir handoff + governance fixed",
    );
    const unknown = resolveBranch({ source: "nope", fixGovernance: false }, context);
    expect(unknown.scenario).toEqual(neutral);
    expect(unknown.governanceScore).toBe(78);
  });
});

describe("project: hostile inputs", () => {
  it("returns finite numbers for extreme assumptions, scores and baselines", () => {
    const extremes = [Number.NaN, -Infinity, -1e9, 0, 1e9, Infinity];
    const finite = (y: YearPoint) =>
      Object.entries(y).every(
        ([key, v]) => key === "flags" || v === null || (typeof v === "number" && Number.isFinite(v)),
      );
    for (const x of extremes) {
      const years = project(
        { ...base, ebitda: x, interestRate: x, multiple: x },
        { ...neutral, leverage: x },
        x,
        { ebitdaGrowth: x, cashConversion: x },
      );
      expect(years).toHaveLength(11);
      expect(years.every(finite)).toBe(true);
    }
  });
});

describe("project: edge cases from the October architecture review", () => {
  it("treats a loss as a cash loss in full, not scaled down by cash conversion", () => {
    const loss = project({ ...base, ebitda: -10, existingDebt: 0 }, neutralScenario({ ...base, ebitda: -10 }), 0, {
      ...DEFAULT_ASSUMPTIONS,
      cashConversion: 0.1,
    });
    expect(loss[1].freeCashFlow).toBeCloseTo(-10);
  });

  it("never lets underwater equity reduce what the owners already took out (limited liability)", () => {
    const points = project({ ...base, multiple: 3 }, { ...neutral, leverage: 5 }, 0, DEFAULT_ASSUMPTIONS);
    const day0 = points[0];
    expect(day0.equityValue).toBeLessThan(0);
    expect(day0.shareholderValue).toBeCloseTo(day0.cumulativeCash);
  });
});
