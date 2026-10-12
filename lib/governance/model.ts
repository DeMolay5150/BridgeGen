import { clamp } from "../simulator/defaults";
import type {
  GovernanceAnswers,
  GovernanceCategoryId,
  GovernanceCategoryScore,
  GovernanceItemScore,
  GovernanceScore,
  MeetingCadence,
  Practice,
} from "./types";

/**
 * Governance Debt: undocumented authority, missing board seats and informal
 * voting rules, scored 0–100 and priced as a valuation discount.
 */

/** Largest valuation discount a buyer or lender applies for having no governance at all. */
export const MAX_GOVERNANCE_DISCOUNT = 0.3;
export const MAX_BOARD_SEATS = 15;
export const INDEPENDENT_DIRECTOR_TARGET = 2;

const PRACTICE_GAP: Record<Practice, number> = { yes: 0, partial: 0.5, no: 1 };
const CADENCE_GAP: Record<MeetingCadence, number> = { quarterly: 0, annual: 0.5, adhoc: 1 };

export const CATEGORY_LABELS: Record<GovernanceCategoryId, string> = {
  authority: "Undocumented authority",
  board: "Missing board seats",
  voting: "Informal voting rules",
};

/** Whole number of seats between 0 and MAX_BOARD_SEATS. */
const seats = (value: number) => Math.round(clamp(value, { min: 0, max: MAX_BOARD_SEATS }));
const practiceGap = (value: Practice) => PRACTICE_GAP[value] ?? 1;

interface ItemSpec {
  id: GovernanceItemScore["id"];
  label: string;
  category: GovernanceCategoryId;
  maxPoints: number;
  /** 0 = no gap, 1 = fully missing. */
  gap: (answers: GovernanceAnswers) => number;
}

const ITEMS: ItemSpec[] = [
  {
    id: "delegationOfAuthority",
    label: "Delegation of authority documented",
    category: "authority",
    maxPoints: 12,
    gap: (a) => practiceGap(a.delegationOfAuthority),
  },
  {
    id: "successionPlan",
    label: "Written CEO succession plan",
    category: "authority",
    maxPoints: 12,
    gap: (a) => practiceGap(a.successionPlan),
  },
  {
    id: "incapacitationPlan",
    label: "Incapacitation plan",
    category: "authority",
    maxPoints: 11,
    gap: (a) => practiceGap(a.incapacitationPlan),
  },
  {
    id: "boardSeats",
    label: "Board seats filled",
    category: "board",
    maxPoints: 15,
    gap: (a) => {
      const recommended = seats(a.boardSeatsRecommended);
      if (recommended === 0) return 0;
      return clamp(1 - seats(a.boardSeatsFilled) / recommended, { min: 0, max: 1 });
    },
  },
  {
    id: "independentDirectors",
    label: "Independent directors",
    category: "board",
    maxPoints: 12,
    gap: (a) => {
      const independents = Math.min(seats(a.independentDirectors), seats(a.boardSeatsFilled));
      return 1 - Math.min(independents, INDEPENDENT_DIRECTOR_TARGET) / INDEPENDENT_DIRECTOR_TARGET;
    },
  },
  {
    id: "meetingCadence",
    label: "Board meeting cadence",
    category: "board",
    maxPoints: 8,
    gap: (a) => CADENCE_GAP[a.meetingCadence] ?? 1,
  },
  {
    id: "buySellAgreement",
    label: "Shareholder / buy-sell agreement",
    category: "voting",
    maxPoints: 12,
    gap: (a) => practiceGap(a.buySellAgreement),
  },
  {
    id: "votingRules",
    label: "Voting rules formally written",
    category: "voting",
    maxPoints: 10,
    gap: (a) => practiceGap(a.votingRules),
  },
  {
    id: "disputeResolution",
    label: "Dispute resolution / family council",
    category: "voting",
    maxPoints: 8,
    gap: (a) => practiceGap(a.disputeResolution),
  },
];

/** A typical founder-led family business: most governance lives in the founder's head. */
export const DEMO_GOVERNANCE: GovernanceAnswers = {
  delegationOfAuthority: "no",
  successionPlan: "partial",
  incapacitationPlan: "no",
  boardSeatsFilled: 2,
  boardSeatsRecommended: 5,
  independentDirectors: 0,
  meetingCadence: "annual",
  buySellAgreement: "partial",
  votingRules: "no",
  disputeResolution: "no",
};

export const BEST_PRACTICE_GOVERNANCE: GovernanceAnswers = {
  delegationOfAuthority: "yes",
  successionPlan: "yes",
  incapacitationPlan: "yes",
  boardSeatsFilled: 5,
  boardSeatsRecommended: 5,
  independentDirectors: 2,
  meetingCadence: "quarterly",
  buySellAgreement: "yes",
  votingRules: "yes",
  disputeResolution: "yes",
};

export function scoreGovernance(answers: GovernanceAnswers): GovernanceScore {
  const items: GovernanceItemScore[] = ITEMS.map((spec) => ({
    id: spec.id,
    label: spec.label,
    category: spec.category,
    maxPoints: spec.maxPoints,
    points: spec.maxPoints * clamp(spec.gap(answers), { min: 0, max: 1 }),
  }));

  const categories: GovernanceCategoryScore[] = (
    Object.keys(CATEGORY_LABELS) as GovernanceCategoryId[]
  ).map((id) => {
    const inCategory = items.filter((item) => item.category === id);
    return {
      id,
      label: CATEGORY_LABELS[id],
      points: inCategory.reduce((sum, item) => sum + item.points, 0),
      maxPoints: inCategory.reduce((sum, item) => sum + item.maxPoints, 0),
    };
  });

  const score = clamp(
    items.reduce((sum, item) => sum + item.points, 0),
    { min: 0, max: 100 },
  );
  return { score, items, categories };
}

/** Value at risk in USD millions: the governance discount a buyer or lender would apply. */
export function governanceDebtValue(enterpriseValue: number, points: number): number {
  const ev = Number.isFinite(enterpriseValue) ? Math.max(enterpriseValue, 0) : 0;
  return (ev * MAX_GOVERNANCE_DISCOUNT * clamp(points, { min: 0, max: 100 })) / 100;
}
