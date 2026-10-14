import { scoreGovernance } from "../governance/model";
import type { GovernanceAnswers, Practice } from "../governance/types";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL } from "../simulator/engine";
import { formatMoney, formatMultiple, formatPercent } from "../simulator/format";
import type { SimulationResult, Severity } from "../simulator/types";

/*
 * The Decision Room map: who owns what after the decision, and how authority
 * flows through the governance structure. Pure graph content; the canvas
 * decides where nodes sit.
 */

export type PracticeKey = "votingRules" | "disputeResolution" | "buySellAgreement" | "successionPlan" | "delegationOfAuthority" | "incapacitationPlan";

export interface MapNode {
  id: string;
  title: string;
  lines: string[];
  tone: Severity | "metric" | "neutral";
  /** Governance practice this node represents; clicking it cycles the answer. */
  practice?: PracticeKey;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  tone?: Severity;
  /** Draw thicker for larger flows (0–1). */
  weight?: number;
}

export interface MapGraph {
  nodes: MapNode[];
  edges: MapEdge[];
}

/** Ownership cascade: holders → equity → enterprise value ← lenders. */
export function ownershipGraph(r: SimulationResult): MapGraph {
  const holders = [
    { id: "founder", title: "Founder", share: r.ownership.founder, value: r.holderEquity.founder },
    { id: "nextGen", title: "Next-gen heir", share: r.ownership.nextGen, value: r.holderEquity.nextGen },
    { id: "others", title: "Other shareholders", share: r.ownership.others, value: r.holderEquity.others },
  ];
  const underwater = r.equityValue <= 0;
  const coverageTone: Severity =
    r.interestCoverage === null || r.interestCoverage >= COVERAGE_CAUTION
      ? "positive"
      : r.interestCoverage >= COVERAGE_CRITICAL
        ? "caution"
        : "critical";

  return {
    nodes: [
      ...holders.map((h) => ({
        id: h.id,
        title: h.title,
        lines: [`${formatPercent(h.share)} of equity`, formatMoney(h.value)],
        tone: (h.share > 0 ? "metric" : "neutral") as MapNode["tone"],
      })),
      {
        id: "equity",
        title: "Shareholders' equity",
        lines: [formatMoney(r.equityValue), underwater ? "Underwater" : `${formatPercent(r.enterpriseValue > 0 ? r.equityValue / r.enterpriseValue : 0)} of EV`],
        tone: underwater ? "critical" : "metric",
      },
      {
        id: "lenders",
        title: "Lenders",
        lines: [formatMoney(r.totalDebt), `Coverage ${formatMultiple(r.interestCoverage)}`],
        tone: r.totalDebt > 0 ? coverageTone : "neutral",
      },
      {
        id: "company",
        title: "Enterprise value",
        lines: [formatMoney(r.enterpriseValue), `${formatMoney(r.adjustedEbitda)} EBITDA × ${formatMultiple(r.effectiveMultiple)}`],
        tone: "metric",
      },
    ],
    edges: [
      ...holders
        .filter((h) => h.share > 0)
        .map((h) => ({ id: `${h.id}-equity`, source: h.id, target: "equity", label: formatPercent(h.share), weight: h.share })),
      { id: "equity-company", source: "equity", target: "company", label: "Residual claim", tone: underwater ? ("critical" as const) : undefined },
      ...(r.totalDebt > 0
        ? [{ id: "lenders-company", source: "lenders", target: "company", label: "Senior claim", tone: coverageTone }]
        : []),
    ],
  };
}

const PRACTICE_TONE: Record<Practice, Severity> = { yes: "positive", partial: "caution", no: "critical" };
const PRACTICE_WORD: Record<Practice, string> = { yes: "In place", partial: "Partial", no: "Missing" };

/** The next answer when a practice node is clicked: in place → partial → missing → in place. */
export const NEXT_PRACTICE: Record<Practice, Practice> = { yes: "partial", partial: "no", no: "yes" };

/** Governance voting tree: shareholders elect the board, which appoints and constrains the CEO. */
export function governanceGraph(a: GovernanceAnswers): MapGraph {
  const g = scoreGovernance(a);
  const practice = (key: PracticeKey, title: string, detail: string): MapNode => ({
    id: key,
    title,
    lines: [PRACTICE_WORD[a[key]], detail],
    tone: PRACTICE_TONE[a[key]],
    practice: key,
  });
  const boardGap = g.categories.find((c) => c.id === "board")!;
  const boardShare = boardGap.maxPoints > 0 ? boardGap.points / boardGap.maxPoints : 0;
  const cadence = { quarterly: "Meets quarterly+", annual: "Meets annually", adhoc: "Meets ad hoc" }[a.meetingCadence];

  return {
    nodes: [
      { id: "shareholders", title: "Shareholders", lines: [`Governance debt ${Math.round(g.score)}/100`], tone: "metric" },
      practice("votingRules", "Voting rules", "Who votes on what"),
      practice("buySellAgreement", "Buy-sell agreement", "Exits, death, divorce"),
      practice("disputeResolution", "Dispute resolution", "Family council path"),
      {
        id: "board",
        title: "Board of directors",
        lines: [
          `${a.boardSeatsFilled} of ${a.boardSeatsRecommended} seats filled`,
          `${a.independentDirectors} independent · ${cadence}`,
        ],
        tone: boardShare >= 0.6 ? "critical" : boardShare >= 0.3 ? "caution" : "positive",
      },
      { id: "ceo", title: "CEO", lines: ["Runs the company"], tone: "neutral" },
      practice("successionPlan", "Succession plan", "Named successor"),
      practice("incapacitationPlan", "Incapacitation plan", "Who decides if the CEO can't"),
      practice("delegationOfAuthority", "Delegated authority", "Who signs, spends, hires"),
    ],
    edges: [
      { id: "sh-votes", source: "shareholders", target: "votingRules", tone: PRACTICE_TONE[a.votingRules] },
      { id: "sh-buysell", source: "shareholders", target: "buySellAgreement", tone: PRACTICE_TONE[a.buySellAgreement] },
      { id: "sh-dispute", source: "shareholders", target: "disputeResolution", tone: PRACTICE_TONE[a.disputeResolution] },
      { id: "votes-board", source: "votingRules", target: "board", label: "Elect" },
      { id: "board-ceo", source: "board", target: "ceo", label: "Appoint & oversee" },
      { id: "board-succession", source: "board", target: "successionPlan", tone: PRACTICE_TONE[a.successionPlan] },
      { id: "ceo-incap", source: "ceo", target: "incapacitationPlan", tone: PRACTICE_TONE[a.incapacitationPlan] },
      { id: "ceo-doa", source: "ceo", target: "delegationOfAuthority", label: "Delegates", tone: PRACTICE_TONE[a.delegationOfAuthority] },
    ],
  };
}
