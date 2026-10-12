import { clamp, neutralScenario } from "./defaults";
import { simulate } from "./engine";
import type { Baseline, Scenario, SimulationResult } from "./types";

/**
 * Economics vs. Alignment scoring. Every score is 0–100 and derived from
 * transparent rules, so each number can be explained in plain language.
 */

const PERCENT = { min: 0, max: 100 };
const pct = (value: number) => clamp(value, PERCENT);

/** Linear 0–100 score: `zeroAt` maps to 0 and `fullAt` maps to 100. */
const ramp = (value: number, zeroAt: number, fullAt: number) =>
  pct(((value - zeroAt) / (fullAt - zeroAt)) * 100);

/** Inputs every stakeholder judges a scenario on. */
export interface SubScores {
  /** Enterprise value relative to today (50 = unchanged). */
  value: number;
  /** Ability to service debt and absorb a shock. */
  resilience: number;
  /** Cash flowing to (above 50) or from (below 50) shareholders. */
  liquidity: number;
  /** Founder's retained control of ownership and management. */
  control: number;
  /** Next generation's progress toward ownership and leadership. */
  succession: number;
  /** Professional management in place. */
  professionalization: number;
}

export type StakeholderId = "founder" | "nextGen" | "board" | "lender";

/** How much each stakeholder cares about each sub-score. Weights per row sum to 1. */
export const STAKEHOLDER_WEIGHTS: Record<
  StakeholderId,
  { label: string; weights: Partial<Record<keyof SubScores | "capitalRetention", number>> }
> = {
  founder: {
    label: "Founder",
    weights: { control: 0.45, value: 0.25, liquidity: 0.15, resilience: 0.15 },
  },
  nextGen: {
    label: "Next-gen heir",
    weights: { succession: 0.5, value: 0.3, resilience: 0.2 },
  },
  board: {
    label: "Board",
    weights: { value: 0.4, resilience: 0.4, professionalization: 0.2 },
  },
  lender: {
    label: "Lender",
    // capitalRetention = 100 − liquidity: lenders dislike cash leaving the business.
    weights: { resilience: 0.8, capitalRetention: 0.2 },
  },
};

const OUTSIDE_CEO_CONTROL_FACTOR = 0.8;
const OUTSIDE_CEO_SUCCESSION_PENALTY = 25;
const PROFESSIONALIZATION = { withCeo: 100, without: 40 };
const COVERAGE_RAMP = { zeroAt: 1, fullAt: 6 };
const LEVERAGE_RAMP = { zeroAt: 6, fullAt: 2 };
const DISAGREEMENT_PENALTY = 0.5;
const ECONOMICS_WEIGHTS = { value: 0.6, resilience: 0.4 };

export function subScores(
  baseline: Baseline,
  scenario: Scenario,
  result: SimulationResult,
  today: SimulationResult,
): SubScores {
  const value =
    today.enterpriseValue > 0
      ? pct(50 + 100 * (result.enterpriseValue / today.enterpriseValue - 1))
      : result.enterpriseValue > 0
        ? 100
        : 50;

  const resilience =
    result.equityValue <= 0 || result.adjustedEbitda <= 0
      ? 0
      : Math.min(
          result.interestCoverage === null
            ? 100
            : ramp(result.interestCoverage, COVERAGE_RAMP.zeroAt, COVERAGE_RAMP.fullAt),
          result.debtToEbitda === null
            ? 0
            : ramp(result.debtToEbitda, LEVERAGE_RAMP.zeroAt, LEVERAGE_RAMP.fullAt),
        );

  const liquidity =
    today.equityValue > 0 ? pct(50 + (100 * result.netDistribution) / today.equityValue) : 50;

  const founderShare = clamp(baseline.founderOwnership, { min: 0, max: 1 });
  const control =
    founderShare > 0
      ? pct(
          (result.ownership.founder / founderShare) *
            100 *
            (scenario.outsideCeo ? OUTSIDE_CEO_CONTROL_FACTOR : 1),
        )
      : 50;

  const succession = pct(
    (result.ownership.nextGen / (founderShare || 1)) * 100 -
      (scenario.outsideCeo ? OUTSIDE_CEO_SUCCESSION_PENALTY : 0),
  );

  const professionalization = scenario.outsideCeo
    ? PROFESSIONALIZATION.withCeo
    : PROFESSIONALIZATION.without;

  return { value, resilience, liquidity, control, succession, professionalization };
}

export interface StakeholderSupport {
  id: StakeholderId;
  label: string;
  support: number;
}

export interface MatrixScore {
  economics: number;
  alignment: number;
  stakeholders: StakeholderSupport[];
  subScores: SubScores;
}

function supportFor(id: StakeholderId, scores: SubScores): number {
  const inputs = { ...scores, capitalRetention: 100 - scores.liquidity };
  const { weights } = STAKEHOLDER_WEIGHTS[id];
  let total = 0;
  for (const [key, weight] of Object.entries(weights) as [keyof typeof inputs, number][]) {
    total += inputs[key] * weight;
  }
  return pct(total);
}

/** Scores one scenario on both matrix axes. Pure; always returns values in 0–100. */
export function scoreScenario(baseline: Baseline, scenario: Scenario): MatrixScore {
  const result = simulate(baseline, scenario);
  const today = simulate(baseline, neutralScenario(baseline));
  const scores = subScores(baseline, scenario, result, today);

  const stakeholders = (Object.keys(STAKEHOLDER_WEIGHTS) as StakeholderId[]).map((id) => ({
    id,
    label: STAKEHOLDER_WEIGHTS[id].label,
    support: supportFor(id, scores),
  }));

  const supports = stakeholders.map((s) => s.support);
  const mean = supports.reduce((sum, s) => sum + s, 0) / supports.length;
  const spread = Math.max(...supports) - Math.min(...supports);

  return {
    economics: pct(
      ECONOMICS_WEIGHTS.value * scores.value + ECONOMICS_WEIGHTS.resilience * scores.resilience,
    ),
    alignment: pct(mean - DISAGREEMENT_PENALTY * spread),
    stakeholders,
    subScores: scores,
  };
}
