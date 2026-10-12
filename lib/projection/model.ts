import { MAX_GOVERNANCE_DISCOUNT } from "../governance/model";
import { BASELINE_LIMITS, clamp } from "../simulator/defaults";
import { COVERAGE_CRITICAL, simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import type { ProjectionAssumptions, YearPoint } from "./types";

export const PROJECTION_YEARS = 10;
export const HORIZONS = [1, 3, 5, 10] as const;

export const DEFAULT_ASSUMPTIONS: ProjectionAssumptions = {
  ebitdaGrowth: 0.04,
  cashConversion: 0.5,
};

export const ASSUMPTION_RANGES = {
  ebitdaGrowth: { min: -0.1, max: 0.15, step: 0.01 },
  cashConversion: { min: 0.1, max: 0.9, step: 0.05 },
};

/** Annual chance of a governance crisis at a Governance Debt Score of 100. */
export const MAX_ANNUAL_DISRUPTION = 0.08;

/** Yearly probability of a governance crisis for a given Governance Debt Score. */
export function annualDisruptionProbability(governanceScore: number): number {
  return (MAX_ANNUAL_DISRUPTION * clamp(governanceScore, { min: 0, max: 100 })) / 100;
}

/**
 * Projects a decision forward year by year. Year 0 is the state immediately
 * after the decision (`simulate()`); each later year grows EBITDA, services
 * debt from free cash flow, pays out the rest, and compounds governance risk.
 */
export function project(
  baseline: Baseline,
  scenario: Scenario,
  governanceScore: number,
  rawAssumptions: ProjectionAssumptions,
): YearPoint[] {
  const day0 = simulate(baseline, scenario);
  const growth = clamp(rawAssumptions.ebitdaGrowth, ASSUMPTION_RANGES.ebitdaGrowth);
  const conversion = clamp(rawAssumptions.cashConversion, ASSUMPTION_RANGES.cashConversion);
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const annualRisk = annualDisruptionProbability(governanceScore);
  const { ownership, effectiveMultiple } = day0;

  const point = (
    year: number,
    values: Pick<YearPoint, "ebitda" | "interest" | "freeCashFlow" | "debtPaydown" | "dividends" | "debt" | "cumulativeCash">,
    previousDebt: number,
  ): YearPoint => {
    const enterpriseValue = Math.max(values.ebitda, 0) * effectiveMultiple;
    const equityValue = enterpriseValue - values.debt;
    const disruptionProbability = 1 - (1 - annualRisk) ** year;
    const expectedGovernanceLoss = enterpriseValue * MAX_GOVERNANCE_DISCOUNT * disruptionProbability;
    const shareholderValue = equityValue - expectedGovernanceLoss + values.cumulativeCash;
    const interestCoverage = values.interest > 0 ? values.ebitda / values.interest : null;
    return {
      year,
      ...values,
      enterpriseValue,
      equityValue,
      disruptionProbability,
      expectedGovernanceLoss,
      shareholderValue,
      founderWealth: ownership.founder * shareholderValue,
      nextGenWealth: ownership.nextGen * shareholderValue,
      interestCoverage,
      flags: {
        underwater: equityValue <= 0,
        thinCoverage: interestCoverage !== null && interestCoverage < COVERAGE_CRITICAL,
        debtGrowing: values.debt > previousDebt + 1e-9,
      },
    };
  };

  const points: YearPoint[] = [
    point(
      0,
      {
        ebitda: day0.adjustedEbitda,
        interest: day0.interestExpense,
        freeCashFlow: 0,
        debtPaydown: 0,
        dividends: 0,
        debt: day0.totalDebt,
        cumulativeCash: day0.netDistribution,
      },
      day0.totalDebt,
    ),
  ];

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    const prev = points[year - 1];
    // Losses don't compound with growth; a loss-making business stays flat.
    const ebitda = prev.ebitda > 0 ? prev.ebitda * (1 + growth) : prev.ebitda;
    const interest = prev.debt * rate;
    const freeCashFlow = ebitda * conversion - interest;
    const debtPaydown = freeCashFlow >= 0 ? Math.min(freeCashFlow, prev.debt) : 0;
    const dividends = freeCashFlow >= 0 ? freeCashFlow - debtPaydown : 0;
    // A cash shortfall is borrowed.
    const debt = freeCashFlow >= 0 ? prev.debt - debtPaydown : prev.debt - freeCashFlow;
    points.push(
      point(
        year,
        {
          ebitda,
          interest,
          freeCashFlow,
          debtPaydown,
          dividends,
          debt,
          cumulativeCash: prev.cumulativeCash + dividends,
        },
        prev.debt,
      ),
    );
  }

  return points;
}
