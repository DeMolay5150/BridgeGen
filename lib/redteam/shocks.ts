import { BEST_PRACTICE_GOVERNANCE, CATEGORY_ANSWER_KEYS, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers, GovernanceCategoryId, GovernanceScore } from "../governance/types";
import { BASELINE_LIMITS, clamp } from "../simulator/defaults";
import {
  COVERAGE_CAUTION,
  COVERAGE_CRITICAL,
  LEVERAGE_CAUTION,
  LEVERAGE_CRITICAL,
  simulate,
} from "../simulator/engine";
import { formatPercent } from "../simulator/format";
import { departingHeir, isSingleDefaultHeir } from "../simulator/heirs";
import type { Baseline, Scenario, SimulationResult } from "../simulator/types";
import type { ShockChanges, ShockId, ShockResult, StressMetrics, Verdict } from "./types";

/** Calibration. Each "× gap" term scales with the matching governance gaps (0–1). */
const INCAPACITATION = { base: 0.05, perAuthorityGap: 0.15, outsideCeoRelief: 0.5 };
const SUCCESSOR_EXIT = { ebitdaCut: 0.03, agreementDiscount: 0.25, disputeCutPerGap: 0.1, perRemainingHeir: 0.25, maxRemainingHeirs: 3 };
const DOWNTURN = { ebitdaCut: 0.25, perBoardGap: 0.1, multipleCut: 0.25, rateIncrease: 0.02 };

interface ShockContext {
  result: SimulationResult;
  scenario: Scenario;
  governance: GovernanceScore;
}

interface ShockOutcome {
  changes: ShockChanges;
  warnings: string[];
}

const NO_CHANGE: ShockChanges = { ebitdaCut: 0, multipleCut: 0, extraDebt: 0, rateIncrease: 0 };

const categoryGap = (g: GovernanceScore, id: GovernanceCategoryId) => {
  const c = g.categories.find((cat) => cat.id === id)!;
  return c.maxPoints > 0 ? c.points / c.maxPoints : 0;
};
const itemGap = (g: GovernanceScore, id: string) => {
  const item = g.items.find((i) => i.id === id)!;
  return item.maxPoints > 0 ? item.points / item.maxPoints : 0;
};

function incapacitation({ result, scenario, governance }: ShockContext): ShockOutcome {
  const cut = INCAPACITATION.base + INCAPACITATION.perAuthorityGap * categoryGap(governance, "authority");
  const warnings: string[] = [];
  if (result.ownership.founder > 0.5 && itemGap(governance, "incapacitationPlan") > 0) {
    warnings.push(
      `Control vacuum: the founder holds ${formatPercent(result.ownership.founder)} and there is no complete incapacitation plan to say who decides.`,
    );
  }
  if (scenario.outsideCeo) warnings.push("The outside CEO halves the operating hit: the business no longer runs on the founder alone.");
  return {
    changes: {
      ...NO_CHANGE,
      ebitdaCut: scenario.outsideCeo ? cut * INCAPACITATION.outsideCeoRelief : cut,
      multipleCut: cut,
    },
    warnings,
  };
}

/**
 * The successor walks away: the largest active heir (else the largest heir)
 * is bought out with new debt. Every heir who stays is another party to a
 * contested price, so the dispute discount grows with them.
 */
function successorExit({ result, governance }: ShockContext): ShockOutcome {
  const heir = departingHeir(result.heirs);
  const heirStake = heir ? heir.ownership * Math.max(result.equityValue, 0) : 0;
  if (!heir || heirStake <= 0) {
    return {
      changes: { ...NO_CHANGE, ebitdaCut: SUCCESSOR_EXIT.ebitdaCut },
      warnings: ["No heir stake: limited exposure. Only the loss of the successor's management role is felt."],
    };
  }
  const buySellGap = itemGap(governance, "buySellAgreement");
  const price = heirStake * (1 - SUCCESSOR_EXIT.agreementDiscount * (1 - buySellGap));
  const disputeGap =
    (buySellGap + itemGap(governance, "votingRules") + itemGap(governance, "disputeResolution")) / 3;
  const remaining = result.heirs.filter((h) => h !== heir && h.ownership > 0).length;
  const disputeScale = 1 + SUCCESSOR_EXIT.perRemainingHeir * Math.min(remaining, SUCCESSOR_EXIT.maxRemainingHeirs);
  const warnings = isSingleDefaultHeir(result.heirs)
    ? ["The company borrows to buy out the departing heir's shares."]
    : [`The company borrows to buy out ${heir.name}'s shares (${formatPercent(heir.ownership)} of the company).`];
  if (remaining > 0) {
    warnings.push(
      `${remaining} other ${remaining === 1 ? "heir stays" : "heirs stay"} on as ${remaining === 1 ? "an owner" : "owners"}, so a contested price can spread into a wider family dispute.`,
    );
  }
  if (buySellGap >= 1) warnings.push("No buy-sell agreement: the price is set by negotiation or litigation, at full value.");
  return {
    changes: {
      ...NO_CHANGE,
      ebitdaCut: SUCCESSOR_EXIT.ebitdaCut,
      multipleCut: SUCCESSOR_EXIT.disputeCutPerGap * disputeGap * disputeScale,
      extraDebt: price,
    },
    warnings,
  };
}

function downturn({ governance }: ShockContext): ShockOutcome {
  const boardGap = categoryGap(governance, "board");
  return {
    changes: {
      ebitdaCut: DOWNTURN.ebitdaCut + DOWNTURN.perBoardGap * boardGap,
      multipleCut: DOWNTURN.multipleCut,
      extraDebt: 0,
      rateIncrease: DOWNTURN.rateIncrease,
    },
    warnings: boardGap > 0 ? ["A thin, informal board reacts late, deepening the earnings hit."] : [],
  };
}

function perfectStorm(context: ShockContext): ShockOutcome {
  const parts = [incapacitation(context), successorExit(context), downturn(context)];
  return {
    changes: {
      ebitdaCut: 1 - parts.reduce((keep, p) => keep * (1 - p.changes.ebitdaCut), 1),
      multipleCut: 1 - parts.reduce((keep, p) => keep * (1 - p.changes.multipleCut), 1),
      extraDebt: parts.reduce((sum, p) => sum + p.changes.extraDebt, 0),
      rateIncrease: parts.reduce((sum, p) => sum + p.changes.rateIncrease, 0),
    },
    warnings: parts.flatMap((p) => p.warnings),
  };
}

export const SHOCKS: {
  id: ShockId;
  name: string;
  description: string;
  categories: GovernanceCategoryId[];
  run: (context: ShockContext) => ShockOutcome;
}[] = [
  {
    id: "incapacitation",
    name: "Founder incapacitation",
    description: "The founder is suddenly unable to lead or decide.",
    categories: ["authority"],
    run: incapacitation,
  },
  {
    id: "successorExit",
    name: "Successor exit",
    description: "The chosen heir walks away and wants their shares bought out.",
    categories: ["voting"],
    run: successorExit,
  },
  {
    id: "downturn",
    name: "Economic downturn",
    description: "Earnings and valuations fall while borrowing costs rise.",
    categories: ["board"],
    run: downturn,
  },
  {
    id: "perfectStorm",
    name: "Perfect storm",
    description: "All three at once.",
    categories: ["authority", "voting", "board"],
    run: perfectStorm,
  },
];

function metrics(ebitda: number, multiple: number, debt: number, rate: number): StressMetrics {
  const enterpriseValue = Math.max(ebitda, 0) * multiple;
  const interest = debt * rate;
  return {
    ebitda,
    enterpriseValue,
    debt,
    equityValue: enterpriseValue - debt,
    interestCoverage: interest > 0 ? ebitda / interest : null,
    debtToEbitda: ebitda > 0 ? debt / ebitda : null,
  };
}

function verdictOf(m: StressMetrics): Verdict {
  const { interestCoverage: cov, debtToEbitda: lev } = m;
  if (m.equityValue <= 0 || m.ebitda <= 0 || (cov !== null && cov < COVERAGE_CRITICAL) || (lev !== null && lev > LEVERAGE_CRITICAL)) {
    return "breaks";
  }
  if ((cov !== null && cov < COVERAGE_CAUTION) || (lev !== null && lev >= LEVERAGE_CAUTION)) return "strained";
  return "survives";
}

function apply(result: SimulationResult, rate: number, changes: ShockChanges) {
  const before = metrics(result.adjustedEbitda, result.effectiveMultiple, result.totalDebt, rate);
  const ebitda = result.adjustedEbitda > 0 ? result.adjustedEbitda * (1 - changes.ebitdaCut) : result.adjustedEbitda;
  const after = metrics(
    ebitda,
    result.effectiveMultiple * (1 - changes.multipleCut),
    result.totalDebt + changes.extraDebt,
    rate + changes.rateIncrease,
  );
  return { before, after, valueDestroyed: before.equityValue - (after.equityValue + changes.extraDebt) };
}

/** Throws the named shock at the company and reports what breaks. Pure. */
export function runShock(
  baseline: Baseline,
  scenario: Scenario,
  governanceAnswers: GovernanceAnswers,
  shockId: ShockId,
): ShockResult {
  const shock = SHOCKS.find((s) => s.id === shockId)!;
  const result = simulate(baseline, scenario);
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const governance = scoreGovernance(governanceAnswers);

  const { changes, warnings } = shock.run({ result, scenario, governance });
  const outcome = apply(result, rate, changes);

  // Re-run with best practice in this shock's governance categories.
  const gapsInPlay = shock.categories.some((c) => categoryGap(governance, c) > 0);
  let dividend: ShockResult["dividend"] = null;
  if (gapsInPlay) {
    const fixedAnswers = { ...governanceAnswers };
    for (const category of shock.categories) {
      for (const key of CATEGORY_ANSWER_KEYS[category]) {
        Object.assign(fixedAnswers, { [key]: BEST_PRACTICE_GOVERNANCE[key] });
      }
    }
    const fixed = shock.run({ result, scenario, governance: scoreGovernance(fixedAnswers) });
    dividend = {
      categories: shock.categories,
      changes: fixed.changes,
      valueSaved: outcome.valueDestroyed - apply(result, rate, fixed.changes).valueDestroyed,
    };
  }

  return {
    id: shock.id,
    name: shock.name,
    description: shock.description,
    changes,
    ...outcome,
    verdict: verdictOf(outcome.after),
    warnings,
    dividend,
  };
}
