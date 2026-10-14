import { describe, expect, it } from "vitest";
import { parseBaselinePaste, toTsv } from "../clipboard/tsv";
import { irr } from "../finance";
import { DEFAULT_ASSUMPTIONS, project } from "../projection/model";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import { DEFAULT_STATEMENT_ASSUMPTIONS, buildStatements, type StatementAssumptions } from "./model";
import { DEFAULT_MONTE_CARLO, runMonteCarlo } from "./monte-carlo";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const sc = (patch: Partial<Scenario> = {}): Scenario => ({ ...neutral, ...patch });
const assumptions: StatementAssumptions = { ...DEFAULT_STATEMENT_ASSUMPTIONS, revenueGrowth: 0.04 };

const SCENARIOS: [string, Baseline, Scenario][] = [
  ["today", base, neutral],
  ["4x recap", base, sc({ leverage: 4 })],
  ["6x recap in a falling market", base, sc({ leverage: 6, multipleShock: -0.4 })],
  ["outside CEO", base, sc({ outsideCeo: true })],
  ["debt-free", { ...base, existingDebt: 0 }, neutralScenario({ ...base, existingDebt: 0 })],
  ["loss-making", { ...base, ebitda: -2 }, neutralScenario({ ...base, ebitda: -2 })],
];

describe("three-statement model", () => {
  it.each(SCENARIOS)("balances every year: %s", (_, baseline, scenario) => {
    for (const shrink of [assumptions, { ...assumptions, revenueGrowth: -0.2 }]) {
      const { years } = buildStatements(baseline, scenario, shrink);
      expect(years).toHaveLength(11);
      years.forEach((y) => expect(Math.abs(y.balanceCheck)).toBeLessThan(1e-9));
    }
  });

  it("starts from the simulator's post-decision position", () => {
    const scenario = sc({ leverage: 3 });
    const day0 = simulate(base, scenario);
    const y0 = buildStatements(base, scenario, assumptions).years[0];
    expect(y0.debt).toBeCloseTo(day0.totalDebt, 9);
    expect(y0.equityValue).toBeCloseTo(day0.equityValue, 9);
    expect(y0.enterpriseValue).toBeCloseTo(day0.enterpriseValue, 9);
  });

  it("grows EBITDA exactly as Fork the Future does at the same growth rate", () => {
    const fork = project(base, neutral, 0, { ...DEFAULT_ASSUMPTIONS, ebitdaGrowth: 0.04 });
    const { years } = buildStatements(base, neutral, assumptions);
    years.forEach((y, i) => expect(y.ebitda).toBeCloseTo(fork[i].ebitda, 9));
  });

  it("links the statements: interest on opening debt, cash flow into cash, earnings into equity", () => {
    const { years } = buildStatements(base, sc({ leverage: 4 }), assumptions);
    for (let i = 1; i < years.length; i++) {
      const [prev, y] = [years[i - 1], years[i]];
      expect(y.interest).toBeCloseTo(prev.debt * base.interestRate, 9);
      expect(y.netIncome).toBeCloseTo((y.ebit - y.interest) * (1 - 0.25), 9);
      expect(y.freeCashFlow).toBeCloseTo(y.netIncome + y.depreciation - y.changeInWorkingCapital - y.capex, 9);
      expect(y.equity).toBeCloseTo(prev.equity + y.netIncome - y.dividends, 9);
      expect(y.fixedAssets).toBeCloseTo(prev.fixedAssets + y.capex - y.depreciation, 9);
    }
  });

  it("repays the recap debt on schedule and sweeps surplus cash before paying dividends", () => {
    const { years } = buildStatements(base, sc({ leverage: 4 }), assumptions);
    expect(years[1].mandatoryRepayment).toBeCloseTo(48 / 7, 9);
    // No dividend is paid in any year that ends with debt outstanding.
    const firstDividend = years.findIndex((y) => y.dividends > 1e-9);
    expect(firstDividend).toBeGreaterThan(1);
    years.filter((y) => y.dividends > 1e-9).forEach((y) => expect(y.debt).toBeLessThan(1e-9));
    expect(years[firstDividend - 1].debt).toBeGreaterThan(0);
    // At 4x, year-1 cash doesn't cover the scheduled repayment: the gap is drawn, not hidden.
    expect(years[1].revolverDraw).toBeGreaterThan(0);
    expect(years[1].freeCashFlow).toBeLessThan(years[1].mandatoryRepayment);
  });

  it("draws on the revolver when the business burns cash", () => {
    const { years } = buildStatements({ ...base, ebitda: -2 }, neutralScenario({ ...base, ebitda: -2 }), assumptions);
    expect(years[1].revolverDraw).toBeGreaterThan(0);
    expect(years[10].debt).toBeGreaterThan(years[0].debt);
  });

  it("computes the shareholders' IRR from today's equity, day-0 cash, dividends and final value", () => {
    const m = buildStatements(base, sc({ leverage: 3 }), assumptions);
    const flows = [-m.todayEquityValue + m.day0Distribution, ...m.years.slice(1, 10).map((y) => y.dividends), m.years[10].dividends + m.years[10].equityValue];
    expect(m.equityIrr).toBeCloseTo(irr(flows)!, 12);
    expect(m.equityIrr).toBeGreaterThan(0);
    // 25% tax on 8% debt; equity at 14%.
    const day0 = simulate(base, sc({ leverage: 3 }));
    const expected = (day0.equityValue * 0.14 + day0.totalDebt * 0.08 * 0.75) / (day0.equityValue + day0.totalDebt);
    expect(m.wacc).toBeCloseTo(expected, 12);
  });
});

describe("Monte Carlo", () => {
  const quick = { ...DEFAULT_MONTE_CARLO, paths: 300 };

  it("is deterministic for a given seed and changes with the seed", () => {
    const a = runMonteCarlo(base, sc({ leverage: 4 }), assumptions, quick);
    expect(runMonteCarlo(base, sc({ leverage: 4 }), assumptions, quick)).toEqual(a);
    expect(runMonteCarlo(base, sc({ leverage: 4 }), assumptions, { ...quick, seed: 7 }).equityValue).not.toEqual(a.equityValue);
  });

  it("collapses to the base case with no volatility", () => {
    const flat = { ...quick, growthVolatility: 0, marginVolatility: 0, multipleVolatility: 0 };
    const r = runMonteCarlo(base, neutral, assumptions, flat);
    expect(r.equityValue.p10).toBeCloseTo(r.baseCaseEquityValue, 9);
    expect(r.equityValue.p90).toBeCloseTo(r.baseCaseEquityValue, 9);
    expect(r.covenantBreachProbability).toBe(0);
  });

  it("makes covenant breaches likelier as leverage rises, with ordered percentiles", () => {
    const low = runMonteCarlo(base, neutral, assumptions, quick);
    const high = runMonteCarlo(base, sc({ leverage: 5 }), assumptions, quick);
    expect(high.covenantBreachProbability).toBeGreaterThan(low.covenantBreachProbability);
    expect(high.equityValue.p10).toBeLessThanOrEqual(high.equityValue.p50);
    expect(high.equityValue.p50).toBeLessThanOrEqual(high.equityValue.p90);
    expect(high.histogram.reduce((s, b) => s + b.count, 0)).toBe(300);
  });
});

describe("spreadsheet clipboard", () => {
  it("writes TSV that keeps full precision and strips separators from labels", () => {
    expect(toTsv([["Revenue\t($M)", 40.1234567], ["Debt", null]])).toBe("Revenue ($M)\t40.123457\nDebt\t");
  });

  it("reads label/value pairs in any order, with spreadsheet units", () => {
    const text = "Interest rate (%)\t8.50%\nRevenue ($M)\t$42,000,000\nEBITDA multiple\t7.5x\nFounder ownership\t65\nNotes\tignored";
    expect(parseBaselinePaste(text)).toEqual({ interestRate: 0.085, revenue: 42, multiple: 7.5, founderOwnership: 0.65 });
  });

  it("reads bare numbers in the panel's order, as a row or a column", () => {
    const expected = { revenue: 40, ebitda: 12, multiple: 8, existingDebt: 6, interestRate: 0.08, founderOwnership: 0.8 };
    expect(parseBaselinePaste("40\t12\t8\t6\t8%\t80%")).toEqual(expected);
    expect(parseBaselinePaste("40\n12\n8\n6\n0.08\n0.8\n")).toEqual(expected);
  });

  it("returns null for text that isn't a baseline", () => {
    expect(parseBaselinePaste("hello\tworld")).toBeNull();
    expect(parseBaselinePaste("")).toBeNull();
  });
});
