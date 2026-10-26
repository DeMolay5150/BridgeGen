import { MAX_GOVERNANCE_DISCOUNT } from "../governance/model";
import { clamp } from "../simulator/defaults";
import { COVERAGE_CRITICAL, simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import { DEFAULT_STATEMENT_ASSUMPTIONS, buildStatements, type StatementAssumptions } from "../statements/model";
import type { ProjectionAssumptions, YearPoint } from "./types";

export { HORIZONS, PROJECTION_YEARS } from "./horizon";

export const DEFAULT_ASSUMPTIONS: ProjectionAssumptions = {
  ebitdaGrowth: 0.04,
};

export const ASSUMPTION_RANGES = {
  ebitdaGrowth: { min: -0.1, max: 0.15, step: 0.01 },
};

/** The default statement inputs at the default growth rate. */
export const DEFAULT_PROJECTION_INPUTS: StatementAssumptions = {
  ...DEFAULT_STATEMENT_ASSUMPTIONS,
  revenueGrowth: DEFAULT_ASSUMPTIONS.ebitdaGrowth,
};

/** Annual chance of a governance crisis at a Governance Debt Score of 100. */
export const MAX_ANNUAL_DISRUPTION = 0.08;

/** Yearly probability of a governance crisis for a given Governance Debt Score. */
export function annualDisruptionProbability(governanceScore: number): number {
  return (MAX_ANNUAL_DISRUPTION * clamp(governanceScore, { min: 0, max: 100 })) / 100;
}

/**
 * Projects a decision forward year by year: the three-statement model
 * (`buildStatements()`, the same cash flows and debt the liquidity alerts
 * read) with the governance overlay on top. Year 0 is the state immediately
 * after the decision; each later year compounds the chance of a governance
 * crisis and its Expected Loss.
 */
export function project(
  baseline: Baseline,
  scenario: Scenario,
  governanceScore: number,
  assumptions: StatementAssumptions,
): YearPoint[] {
  const model = buildStatements(baseline, scenario, assumptions);
  const { ownership } = simulate(baseline, scenario);
  const annualRisk = annualDisruptionProbability(governanceScore);

  let cumulativeCash = model.day0Distribution;
  return model.years.map((y, i) => {
    const previousDebt = i > 0 ? model.years[i - 1].debt : y.debt;
    if (i > 0) cumulativeCash += y.dividends;
    const enterpriseValue = Math.max(y.enterpriseValue, 0);
    // Limited liability, as in simulate(): underwater equity is worth nothing, not a debt the owners repay.
    const ownersEquity = Math.max(y.equityValue, 0);
    const disruptionProbability = 1 - (1 - annualRisk) ** y.year;
    const expectedGovernanceLoss = enterpriseValue * MAX_GOVERNANCE_DISCOUNT * disruptionProbability;
    const shareholderValue = ownersEquity - expectedGovernanceLoss + cumulativeCash;
    return {
      year: y.year,
      ebitda: y.ebitda,
      interest: y.interest,
      freeCashFlow: y.freeCashFlow,
      debtPaydown: y.mandatoryRepayment + y.cashSweep,
      borrowed: y.revolverDraw,
      dividends: y.dividends,
      debt: y.debt,
      enterpriseValue,
      equityValue: y.equityValue,
      ownersEquity,
      cumulativeCash,
      disruptionProbability,
      expectedGovernanceLoss,
      shareholderValue,
      founderWealth: ownership.founder * shareholderValue,
      nextGenWealth: ownership.nextGen * shareholderValue,
      interestCoverage: y.interestCoverage,
      flags: {
        underwater: y.equityValue <= 0,
        thinCoverage: y.interestCoverage !== null && y.interestCoverage < COVERAGE_CRITICAL,
        debtGrowing: y.debt > previousDebt + 1e-9,
      },
    };
  });
}
