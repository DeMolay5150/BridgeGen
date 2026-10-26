import { describe, expect, it } from "vitest";
import { MAX_GOVERNANCE_DISCOUNT } from "../governance/model";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import { buildStatements, type StatementAssumptions } from "../statements/model";
import { resolveBranch } from "./branches";
import { DEFAULT_PROJECTION_INPUTS, annualDisruptionProbability, project } from "./model";
import type { YearPoint } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const inputs = DEFAULT_PROJECTION_INPUTS;
const run = (
  scenario: Partial<Scenario> = {},
  governance = 0,
  assumptions: Partial<StatementAssumptions> = {},
  baseline: Partial<Baseline> = {},
) => project({ ...base, ...baseline }, { ...neutral, ...scenario }, governance, { ...inputs, ...assumptions });

describe("project: a view over the three statements", () => {
  it("returns years 0 through 10", () => {
    expect(run().map((y) => y.year)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("starts from the day-0 simulation", () => {
    const [y0] = run({}, 78);
    expect(y0).toMatchObject({ ebitda: 12, debt: 6, enterpriseValue: 96, equityValue: 90, ownersEquity: 90, cumulativeCash: 0 });
    expect(y0.expectedGovernanceLoss).toBe(0);
    expect(y0.shareholderValue).toBe(90);
  });

  // The R1 finding: the chart and the liquidity alerts beside it must describe the same company.
  for (const leverage of [0, 3, 5.5]) {
    it(`carries the statements' debt, cash flows and dividends unchanged at ${leverage}x`, () => {
      const scenario = { ...neutral, leverage };
      const points = project(base, scenario, 0, inputs);
      const { years, day0Distribution } = buildStatements(base, scenario, inputs);
      let paid = day0Distribution;
      points.forEach((p, i) => {
        const y = years[i];
        if (i > 0) paid += y.dividends;
        expect(p.debt).toBe(y.debt);
        expect(p.interest).toBe(y.interest);
        expect(p.freeCashFlow).toBe(y.freeCashFlow);
        expect(p.dividends).toBe(y.dividends);
        expect(p.debtPaydown).toBeCloseTo(y.mandatoryRepayment + y.cashSweep, 12);
        expect(p.borrowed).toBe(y.revolverDraw);
        expect(p.equityValue).toBe(y.equityValue);
        expect(p.cumulativeCash).toBeCloseTo(paid, 12);
      });
    });
  }

  it("flags debt growing only in years the revolver is drawn", () => {
    const points = run({ leverage: 6 }, 0, { revenueGrowth: -0.1 });
    expect(points.some((p) => p.flags.debtGrowing)).toBe(true);
    points.slice(1).forEach((p) => {
      if (p.flags.debtGrowing) expect(p.borrowed).toBeGreaterThan(0);
    });
  });

  it("adds up: owners' equity − Expected Loss + cash paid out", () => {
    for (const p of run({ leverage: 4 }, 78)) {
      expect(p.shareholderValue).toBeCloseTo(p.ownersEquity - p.expectedGovernanceLoss + p.cumulativeCash, 9);
    }
  });

  it("leaves day-0 shareholder value unchanged by leverage alone", () => {
    for (const leverage of [0, 1, 3, 6]) {
      expect(run({ leverage })[0].shareholderValue).toBeCloseTo(90);
    }
  });

  it("makes a dividend recap cost value over time through interest", () => {
    expect(run({ leverage: 3 })[10].shareholderValue).toBeLessThan(run()[10].shareholderValue);
  });

  it("splits shareholder value by post-transfer ownership", () => {
    const y5 = run({ equityTransfer: 0.5 })[5];
    expect(y5.founderWealth).toBeCloseTo(0.4 * y5.shareholderValue);
    expect(y5.nextGenWealth).toBeCloseTo(0.4 * y5.shareholderValue);
  });

  it("never lets underwater equity reduce what the owners already took out (limited liability)", () => {
    const points = project({ ...base, multiple: 3 }, { ...neutral, leverage: 5 }, 0, inputs);
    const day0 = points[0];
    expect(day0.equityValue).toBeLessThan(0);
    expect(day0.ownersEquity).toBe(0);
    expect(day0.shareholderValue).toBeCloseTo(day0.cumulativeCash);
  });

  it("values a loss-making business at zero", () => {
    const years = run({}, 0, { revenueGrowth: 0.15 }, { ebitda: -2 });
    expect(years[10].ebitda).toBeLessThan(0);
    expect(years[10].enterpriseValue).toBe(0);
    expect(years[10].flags.underwater).toBe(true);
  });
});

describe("governance overlay (Expected Loss)", () => {
  it("scales the annual disruption probability with the score", () => {
    expect(annualDisruptionProbability(0)).toBe(0);
    expect(annualDisruptionProbability(78)).toBeCloseTo(0.0624);
    expect(annualDisruptionProbability(100)).toBeCloseTo(0.08);
    expect(annualDisruptionProbability(500)).toBeCloseTo(0.08);
  });

  it("is enterprise value × the maximum discount × the chance of a crisis by that year", () => {
    const years = run({}, 78);
    for (const y of years) {
      expect(y.disruptionProbability).toBeCloseTo(1 - 0.9376 ** y.year, 12);
      expect(y.expectedGovernanceLoss).toBeCloseTo(y.enterpriseValue * MAX_GOVERNANCE_DISCOUNT * y.disruptionProbability, 12);
    }
    expect(years[10].disruptionProbability).toBeCloseTo(0.475, 3);
  });

  it("is zero when governance is fixed", () => {
    const fixed = resolveBranch({ source: "today", fixGovernance: true }, { baseline: base, scenario: neutral, governanceScore: 78 });
    expect(fixed.governanceScore).toBe(0);
    for (const y of project(base, fixed.scenario, fixed.governanceScore, inputs)) {
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

  it("uses the simulator's ownership split", () => {
    const scenario = { ...neutral, equityTransfer: 0.3 };
    const { ownership } = simulate(base, scenario);
    const y3 = project(base, scenario, 78, inputs)[3];
    expect(y3.nextGenWealth).toBeCloseTo(ownership.nextGen * y3.shareholderValue, 12);
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
        { ...inputs, revenueGrowth: x, taxRate: x, capex: x },
      );
      expect(years).toHaveLength(11);
      expect(years.every(finite)).toBe(true);
    }
  });
});
