import { GOVERNANCE_AREA, describeChanges } from "../redteam/describe";
import type { BreakingPoint, ShockResult, Verdict } from "../redteam/types";
import { formatMoney, formatMultiple, formatPercent } from "../simulator/format";
import type { ExecutiveBrief } from "./types";

/** Changes under $50K are treated as noise. */
const MATERIAL = 0.05;
/** Breaking points within half a point of each other are equally fragile (as on the Red Team page). */
const SAME_FRAGILITY = 0.005;

const VERDICT_RANK: Record<Verdict, number> = { breaks: 2, strained: 1, survives: 0 };

/** Worst verdict first, then the most equity destroyed. */
const byDamage = (a: ShockResult, b: ShockResult) =>
  VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict] || b.valueDestroyed - a.valueDestroyed;

const declineOf = (p: BreakingPoint) => (p.driver === "EBITDA" ? "EBITDA" : "the valuation multiple");

/** "Debt rises above 5.0x EBITDA" → "debt rises above 5.0x EBITDA" (keeps acronyms intact). */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** "the perfect storm case", "the founder incapacitation case". */
const theCase = (s: ShockResult) => `the ${s.name.toLowerCase()} case`;

/** Closest breaking point that can break at all. */
const firstBreak = (points: BreakingPoint[]) => points.find((p) => p.threshold !== null);

function headroomFinding(yours: BreakingPoint[], today: BreakingPoint[]): string {
  const first = firstBreak(yours);
  if (!first) return "No debt-service exposure: no fall in EBITDA or the multiple breaches a lender limit.";
  const threshold = first.threshold!;
  if (threshold === 0) return `Already in breach before any shock: ${lowerFirst(first.limit)}.`;
  const todays = today.find((p) => p.id === first.id)?.threshold ?? null;
  const versus =
    todays === null
      ? "a limit that cannot break today"
      : Math.abs(todays - threshold) < SAME_FRAGILITY
        ? "unchanged from today"
        : `versus ${formatPercent(todays, 1)} today`;
  return `Headroom: a ${formatPercent(threshold, 1)} fall in ${declineOf(first)} trips the first limit (${lowerFirst(first.limit)}), ${versus}.`;
}

/**
 * Executive summary of Red Team Mode: does the structure survive, what is the
 * binding risk, and what is the cheapest mitigant. Pure; figures come from
 * `runShock` and `breakingPoints`.
 */
export function redTeamBrief(shocks: ShockResult[], yours: BreakingPoint[], today: BreakingPoint[]): ExecutiveBrief {
  const ranked = [...shocks].sort(byDamage);
  const worst = ranked[0];
  const failed = shocks.filter((s) => s.verdict === "breaks").length;
  const destroyed = formatMoney(Math.max(worst.valueDestroyed, 0));

  const headline =
    worst.verdict === "breaks"
      ? `The structure fails ${failed} of ${shocks.length} stress cases; ${theCase(worst)} is the binding risk, erasing ${destroyed} of equity.`
      : worst.verdict === "strained"
        ? `The structure holds, but with thin headroom: ${theCase(worst)} pushes it to covenant-watch levels and erases ${destroyed} of equity.`
        : `The structure is stress-resilient: all ${shocks.length} cases clear the coverage and leverage limits, with worst-case equity erosion of ${destroyed} in ${theCase(worst)}.`;

  const findings = [
    headroomFinding(yours, today),
    `${worst.name}: ${describeChanges(worst.changes)}; coverage ${formatMultiple(worst.before.interestCoverage)} → ${formatMultiple(worst.after.interestCoverage)}, equity ${formatMoney(worst.before.equityValue)} → ${formatMoney(worst.after.equityValue)}.`,
  ];

  const hedge = shocks
    .filter((s) => s.dividend && s.dividend.valueSaved > MATERIAL)
    .sort((a, b) => b.dividend!.valueSaved - a.dividend!.valueSaved)[0];
  const hedgeAreas = hedge?.dividend?.categories.map((c) => GOVERNANCE_AREA[c]).join(", ");
  if (hedge) {
    findings.push(
      `Governance is the cheapest hedge: best-practice ${hedgeAreas} would preserve ${formatMoney(hedge.dividend!.valueSaved)} in ${theCase(hedge)}.`,
    );
  }

  const actions: string[] = [];
  if (hedge) {
    actions.push(`Close the ${hedgeAreas} gaps before executing: worth ${formatMoney(hedge.dividend!.valueSaved)} in the downside, at no balance-sheet cost.`);
  }
  const downturn = shocks.find((s) => s.id === "downturn");
  if (downturn && downturn.verdict !== "survives") {
    actions.push(
      `Re-size leverage or extend maturities: an ordinary downturn alone ${downturn.verdict === "breaks" ? "breaks" : "strains"} the structure.`,
    );
  }
  const exit = shocks.find((s) => s.id === "successorExit");
  if (exit && exit.changes.extraDebt > MATERIAL && exit.verdict !== "survives") {
    actions.push(
      `Pre-arrange funding for a potential heir buyout (${formatMoney(exit.changes.extraDebt)}) rather than borrowing for it under stress.`,
    );
  }
  const yourFirst = firstBreak(yours)?.threshold ?? Infinity;
  const todayFirst = firstBreak(today)?.threshold ?? Infinity;
  if (yourFirst < todayFirst - SAME_FRAGILITY) {
    actions.push(
      `Revisit the decision itself: it leaves less headroom than standing still (${formatPercent(yourFirst, 1)} vs. ${Number.isFinite(todayFirst) ? formatPercent(todayFirst, 1) : "no breaking point"} today).`,
    );
  }
  if (actions.length === 0) {
    actions.push("No structural action required; re-run the stress test at each refinancing or change in ownership.");
  }

  return { headline, tone: worst.verdict === "breaks" ? "critical" : worst.verdict === "strained" ? "caution" : "positive", findings, actions };
}
