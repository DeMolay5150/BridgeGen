import { amortize, irr, wacc } from "../finance";
import { PROJECTION_YEARS } from "../projection/model";
import { BASELINE_LIMITS, clamp, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";

/** Operating assumptions behind the three statements. Fractions; "% revenue" unless noted. */
export interface StatementAssumptions {
  /** Annual revenue growth; margins are held, so EBITDA grows at the same rate. */
  revenueGrowth: number;
  taxRate: number;
  depreciation: number;
  capex: number;
  /** Net working capital held, as a share of revenue. */
  workingCapital: number;
  /** Net PP&E on day 0. */
  fixedAssets: number;
  /** Minimum operating cash. Counted inside enterprise value, so it never changes equity value. */
  minimumCash: number;
  /** Years over which the day-0 debt amortizes (straight line); excess cash sweeps the rest. */
  debtTermYears: number;
  costOfEquity: number;
}

export const DEFAULT_STATEMENT_ASSUMPTIONS: Omit<StatementAssumptions, "revenueGrowth"> = {
  taxRate: 0.25,
  depreciation: 0.03,
  capex: 0.035,
  workingCapital: 0.1,
  fixedAssets: 0.3,
  minimumCash: 0.05,
  debtTermYears: 7,
  costOfEquity: 0.14,
};

export const STATEMENT_RANGES: Record<Exclude<keyof StatementAssumptions, "revenueGrowth">, { min: number; max: number; step: number }> = {
  taxRate: { min: 0, max: 0.5, step: 0.01 },
  depreciation: { min: 0, max: 0.15, step: 0.005 },
  capex: { min: 0, max: 0.2, step: 0.005 },
  workingCapital: { min: -0.1, max: 0.4, step: 0.01 },
  fixedAssets: { min: 0, max: 2, step: 0.05 },
  minimumCash: { min: 0, max: 0.2, step: 0.01 },
  debtTermYears: { min: 1, max: 15, step: 1 },
  costOfEquity: { min: 0.05, max: 0.3, step: 0.005 },
};

export interface StatementYear {
  year: number;
  // Income statement
  revenue: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  interest: number;
  taxes: number;
  netIncome: number;
  // Cash flow statement
  operatingCashFlow: number;
  changeInWorkingCapital: number;
  capex: number;
  freeCashFlow: number;
  mandatoryRepayment: number;
  cashSweep: number;
  revolverDraw: number;
  dividends: number;
  // Balance sheet (end of year)
  cash: number;
  workingCapital: number;
  fixedAssets: number;
  totalAssets: number;
  debt: number;
  equity: number;
  /** Assets − (debt + equity). Zero by construction; exposed so tests and the UI can prove it. */
  balanceCheck: number;
  // Valuation and credit
  enterpriseValue: number;
  equityValue: number;
  interestCoverage: number | null;
  debtToEbitda: number | null;
}

export interface StatementModel {
  years: StatementYear[];
  /** Cash returned at day 0 (recap, positive) or contributed (negative). */
  day0Distribution: number;
  /** Equity value before the decision: what shareholders hold today. */
  todayEquityValue: number;
  /** Shareholders' IRR: today's equity in; day-0 cash, dividends and final equity value out. */
  equityIrr: number | null;
  wacc: number | null;
}

/** Optional per-year overrides, used by the Monte Carlo paths (index 0 = year 1). */
export interface PathOverrides {
  growth?: number[];
  marginShift?: number[];
  multipleShift?: number;
}

function sanitize(a: StatementAssumptions): StatementAssumptions {
  const out = { ...a };
  for (const key of Object.keys(STATEMENT_RANGES) as (keyof typeof STATEMENT_RANGES)[]) {
    out[key] = clamp(a[key], STATEMENT_RANGES[key]);
  }
  out.debtTermYears = Math.round(out.debtTermYears);
  out.revenueGrowth = clamp(a.revenueGrowth, { min: -0.5, max: 0.5 });
  return out;
}

/**
 * A linked income statement, cash flow statement and balance sheet, year 0
 * (straight after the decision) to year 10. Interest accrues on opening
 * debt, so there's no circularity; every year balances exactly.
 */
export function buildStatements(
  baseline: Baseline,
  scenario: Scenario,
  rawAssumptions: StatementAssumptions,
  overrides: PathOverrides = {},
): StatementModel {
  const a = sanitize(rawAssumptions);
  const day0 = simulate(baseline, scenario);
  const today = simulate(baseline, neutralScenario(baseline));
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const revenue0 = Math.max(baseline.revenue, 0);
  const margin0 = revenue0 > 0 ? day0.adjustedEbitda / revenue0 : 0;
  const multiple = day0.effectiveMultiple * (1 + (overrides.multipleShift ?? 0));
  const schedule = amortize(day0.totalDebt, rate, a.debtTermYears, "straightLine");

  const opening: StatementYear = {
    year: 0,
    revenue: revenue0,
    ebitda: day0.adjustedEbitda,
    depreciation: 0,
    ebit: 0,
    interest: 0,
    taxes: 0,
    netIncome: 0,
    operatingCashFlow: 0,
    changeInWorkingCapital: 0,
    capex: 0,
    freeCashFlow: 0,
    mandatoryRepayment: 0,
    cashSweep: 0,
    revolverDraw: 0,
    dividends: 0,
    cash: a.minimumCash * revenue0,
    workingCapital: a.workingCapital * revenue0,
    fixedAssets: a.fixedAssets * revenue0,
    totalAssets: 0,
    debt: day0.totalDebt,
    equity: 0,
    balanceCheck: 0,
    enterpriseValue: day0.enterpriseValue,
    equityValue: day0.equityValue,
    interestCoverage: day0.interestCoverage,
    debtToEbitda: day0.debtToEbitda,
  };
  opening.totalAssets = opening.cash + opening.workingCapital + opening.fixedAssets;
  // Book equity is the day-0 plug; a recap can make it negative, as in real life.
  opening.equity = opening.totalAssets - opening.debt;

  const years = [opening];
  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const prev = years[year - 1];
    const growth = overrides.growth?.[year - 1] ?? a.revenueGrowth;
    const revenue = Math.max(prev.revenue * (1 + growth), 0);
    const margin = margin0 + (overrides.marginShift?.[year - 1] ?? 0);

    const ebitda = margin * revenue;
    const depreciation = a.depreciation * revenue;
    const ebit = ebitda - depreciation;
    const interest = prev.debt * rate;
    const pretax = ebit - interest;
    const taxes = Math.max(pretax, 0) * a.taxRate;
    const netIncome = pretax - taxes;

    const workingCapital = a.workingCapital * revenue;
    const changeInWorkingCapital = workingCapital - prev.workingCapital;
    const operatingCashFlow = netIncome + depreciation - changeInWorkingCapital;
    const capex = a.capex * revenue;
    const freeCashFlow = operatingCashFlow - capex;

    const mandatoryRepayment = Math.min(schedule[year - 1]?.principal ?? 0, prev.debt);
    const minimumCash = a.minimumCash * revenue;
    const surplus = prev.cash + freeCashFlow - mandatoryRepayment - minimumCash;
    const debtAfterMandatory = prev.debt - mandatoryRepayment;
    const cashSweep = surplus > 0 ? Math.min(surplus, debtAfterMandatory) : 0;
    const dividends = surplus > 0 ? surplus - cashSweep : 0;
    const revolverDraw = surplus < 0 ? -surplus : 0;

    const cash = prev.cash + freeCashFlow - mandatoryRepayment - cashSweep - dividends + revolverDraw;
    const fixedAssets = prev.fixedAssets + capex - depreciation;
    const debt = debtAfterMandatory - cashSweep + revolverDraw;
    const equity = prev.equity + netIncome - dividends;
    const totalAssets = cash + workingCapital + fixedAssets;
    const enterpriseValue = Math.max(ebitda, 0) * multiple;

    years.push({
      year,
      revenue,
      ebitda,
      depreciation,
      ebit,
      interest,
      taxes,
      netIncome,
      operatingCashFlow,
      changeInWorkingCapital,
      capex,
      freeCashFlow,
      mandatoryRepayment,
      cashSweep,
      revolverDraw,
      dividends,
      cash,
      workingCapital,
      fixedAssets,
      totalAssets,
      debt,
      equity,
      balanceCheck: totalAssets - (debt + equity),
      enterpriseValue,
      equityValue: enterpriseValue - debt,
      interestCoverage: interest > 0 ? ebitda / interest : null,
      debtToEbitda: ebitda > 0 ? debt / ebitda : null,
    });
  }

  const last = years[years.length - 1];
  const flows = [
    -today.equityValue + day0.netDistribution,
    ...years.slice(1, -1).map((y) => y.dividends),
    last.dividends + Math.max(last.equityValue, 0),
  ];

  return {
    years,
    day0Distribution: day0.netDistribution,
    todayEquityValue: today.equityValue,
    equityIrr: today.equityValue > 0 ? irr(flows) : null,
    wacc: wacc({
      equity: Math.max(day0.equityValue, 0),
      debt: day0.totalDebt,
      costOfEquity: a.costOfEquity,
      costOfDebt: rate,
      taxRate: a.taxRate,
    }),
  };
}
