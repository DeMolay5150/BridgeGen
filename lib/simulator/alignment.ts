import { clamp, neutralScenario } from "./defaults";
import { simulate } from "./engine";
import type { Baseline, HeirHolding, Scenario, SimulationResult } from "./types";

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

export const STAKEHOLDER_LABELS: Record<StakeholderId, string> = {
  founder: "Founder",
  nextGen: "Next-gen heir",
  board: "Board",
  lender: "Lender",
};

export const STAKEHOLDER_IDS = Object.keys(STAKEHOLDER_LABELS) as StakeholderId[];

/** What a stakeholder can care about: each sub-score, plus cash kept in the business (100 − liquidity). */
export type PriorityKey = keyof SubScores | "capitalRetention";

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  control: "Founder control",
  value: "Company value",
  liquidity: "Cash to shareholders",
  resilience: "Financial resilience",
  succession: "Next-gen succession",
  professionalization: "Professional management",
  capitalRetention: "Cash kept in the business",
};

export const PRIORITY_KEYS = Object.keys(PRIORITY_LABELS) as PriorityKey[];

/** Raw importance per priority (0–20); normalized to weights when scoring. */
export type Priorities = Record<StakeholderId, Record<PriorityKey, number>>;

export const PRIORITY_RANGE = { min: 0, max: 20, step: 1 };

const none: Record<PriorityKey, number> = {
  control: 0,
  value: 0,
  liquidity: 0,
  resilience: 0,
  succession: 0,
  professionalization: 0,
  capitalRetention: 0,
};

/** Default priorities: the founding weights × 20 (e.g. founder control 0.45 → 9). */
export const DEFAULT_PRIORITIES: Priorities = {
  founder: { ...none, control: 9, value: 5, liquidity: 3, resilience: 3 },
  nextGen: { ...none, succession: 10, value: 6, resilience: 4 },
  board: { ...none, value: 8, resilience: 8, professionalization: 4 },
  // Lenders dislike cash leaving the business.
  lender: { ...none, resilience: 16, capitalRetention: 4 },
};

const OUTSIDE_CEO_CONTROL_FACTOR = 0.8;
const OUTSIDE_CEO_SUCCESSION_PENALTY = 25;
const PROFESSIONALIZATION = { withCeo: 100, without: 40 };
const COVERAGE_RAMP = { zeroAt: 1, fullAt: 6 };
const LEVERAGE_RAMP = { zeroAt: 6, fullAt: 2 };
const DISAGREEMENT_PENALTY = 0.5;
/** At a Governance Debt Score of 100, resilience is halved. */
const GOVERNANCE_RESILIENCE_DRAG = 0.5;
const ECONOMICS_WEIGHTS = { value: 0.6, resilience: 0.4 };

export function subScores(
  baseline: Baseline,
  scenario: Scenario,
  result: SimulationResult,
  today: SimulationResult,
  governanceScore = 0,
): SubScores {
  const value =
    today.enterpriseValue > 0
      ? pct(50 + 100 * (result.enterpriseValue / today.enterpriseValue - 1))
      : result.enterpriseValue > 0
        ? 100
        : 50;

  // Informal governance makes the same balance sheet more fragile.
  const governanceDrag = 1 - (GOVERNANCE_RESILIENCE_DRAG * pct(governanceScore)) / 100;
  const resilience =
    result.equityValue <= 0 || result.adjustedEbitda <= 0
      ? 0
      : governanceDrag *
          Math.min(
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

/** One heir's own support; the Next-gen heir row is these averaged by stake. */
export interface HeirSupport {
  id: string;
  name: string;
  /** Share of the next generation's stake (shares sum to 1). */
  share: number;
  active: boolean;
  support: number;
}

export interface MatrixScore {
  economics: number;
  alignment: number;
  stakeholders: StakeholderSupport[];
  /** Every heir with a stake, in list order. One default heir gives one row equal to the Next-gen heir. */
  heirs: HeirSupport[];
  /** Highest minus lowest support among the heirs (0 with a single heir). */
  heirDispersion: number;
  subScores: SubScores;
}

export interface Contribution {
  key: PriorityKey;
  label: string;
  /** Normalized weight (0–1). */
  weight: number;
  /** Points this priority adds to (or takes from) support relative to a neutral 50. */
  impact: number;
}

/**
 * The priorities an heir judges a scenario on. An heir who works in the business
 * weighs succession as the Next-gen heir does; one who doesn't experiences
 * succession as income, so that weight counts towards cash to shareholders.
 */
export function heirPriorities(heir: Pick<HeirHolding, "active">, priorities: Priorities = DEFAULT_PRIORITIES) {
  const nextGen = priorities.nextGen;
  if (heir.active) return nextGen;
  return { ...nextGen, succession: 0, liquidity: (nextGen.liquidity ?? 0) + (nextGen.succession ?? 0) };
}

/** Each priority's normalized weight and its pull on support. Empty if nothing matters. */
export function contributions(
  id: StakeholderId,
  scores: SubScores,
  priorities: Priorities = DEFAULT_PRIORITIES,
): Contribution[] {
  return contributionsFrom(priorities[id], scores);
}

/** As `contributions`, for one raw priority set (a stakeholder's or an heir's). */
export function contributionsFrom(raw: Record<PriorityKey, number>, scores: SubScores): Contribution[] {
  const inputs: Record<PriorityKey, number> = { ...scores, capitalRetention: 100 - scores.liquidity };
  const importance = (key: PriorityKey) => clamp(raw[key] ?? 0, PRIORITY_RANGE);
  const total = PRIORITY_KEYS.reduce((sum, key) => sum + importance(key), 0);
  if (total <= 0) return [];
  return PRIORITY_KEYS.filter((key) => importance(key) > 0).map((key) => {
    const weight = importance(key) / total;
    return { key, label: PRIORITY_LABELS[key], weight, impact: weight * (inputs[key] - 50) };
  });
}

function supportFrom(raw: Record<PriorityKey, number>, scores: SubScores): number {
  const parts = contributionsFrom(raw, scores);
  // A stakeholder who cares about nothing is neutral.
  if (parts.length === 0) return 50;
  const inputs: Record<PriorityKey, number> = { ...scores, capitalRetention: 100 - scores.liquidity };
  return pct(parts.reduce((sum, p) => sum + inputs[p.key] * p.weight, 0));
}

/** Scores one scenario on both matrix axes. Pure; always returns values in 0–100. */
export function scoreScenario(
  baseline: Baseline,
  scenario: Scenario,
  /** Governance Debt Score (0–100); drags resilience down. */
  governanceScore = 0,
  /** Each stakeholder's priorities; defaults to the founding weights. */
  priorities: Priorities = DEFAULT_PRIORITIES,
): MatrixScore {
  const result = simulate(baseline, scenario);
  const today = simulate(baseline, neutralScenario(baseline));
  const scores = subScores(baseline, scenario, result, today, governanceScore);

  // Heirs without a stake have no say; normalized shares never all vanish.
  const heirs: HeirSupport[] = result.heirs
    .filter((h) => h.share > 0)
    .map((h) => ({
      id: h.id,
      name: h.name,
      share: h.share,
      active: h.active,
      support: supportFrom(heirPriorities(h, priorities), scores),
    }));
  const heirBlock = heirs.reduce((sum, h) => sum + h.share * h.support, 0);

  const stakeholders = STAKEHOLDER_IDS.map((id) => ({
    id,
    label: STAKEHOLDER_LABELS[id],
    support: id === "nextGen" ? pct(heirBlock) : supportFrom(priorities[id], scores),
  }));

  const supports = stakeholders.map((s) => s.support);
  const mean = supports.reduce((sum, s) => sum + s, 0) / supports.length;
  // Disagreement counts every heir as their own seat, so a split family costs consensus.
  const seats = [...stakeholders.filter((s) => s.id !== "nextGen").map((s) => s.support), ...heirs.map((h) => h.support)];
  const spread = Math.max(...seats) - Math.min(...seats);
  const heirSupports = heirs.map((h) => h.support);

  return {
    economics: pct(
      ECONOMICS_WEIGHTS.value * scores.value + ECONOMICS_WEIGHTS.resilience * scores.resilience,
    ),
    alignment: pct(mean - DISAGREEMENT_PENALTY * spread),
    stakeholders,
    heirs,
    heirDispersion: Math.max(...heirSupports) - Math.min(...heirSupports),
    subScores: scores,
  };
}
