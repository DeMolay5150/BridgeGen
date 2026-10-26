import {
  DEFAULT_PRIORITIES,
  STAKEHOLDER_LABELS,
  contributions,
  contributionsFrom,
  heirPriorities,
  scoreScenario,
  type Priorities,
} from "../simulator/alignment";
import { neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import { formatMoney, formatMultiple, formatPercent } from "../simulator/format";
import type { Baseline, Scenario } from "../simulator/types";
import { attribute } from "./attribution";
import type { Explanation, ExplanationStep } from "./types";

/** Scores are 0–100; one decimal is enough to follow the arithmetic. */
export const formatScore = (n: number) => n.toFixed(1);
const POINTS = { format: (n: number) => `${formatScore(n)} pts`, materiality: 0.05 };

export function explainEconomics(
  baseline: Baseline,
  scenario: Scenario,
  governanceScore = 0,
  priorities: Priorities = DEFAULT_PRIORITIES,
): Explanation {
  const score = scoreScenario(baseline, scenario, governanceScore, priorities);
  const r = simulate(baseline, scenario);
  const today = simulate(baseline, neutralScenario(baseline));
  const { value, resilience } = score.subScores;

  const resilienceReason =
    r.equityValue <= 0 || r.adjustedEbitda <= 0
      ? "zero, because equity is wiped out or EBITDA is not positive"
      : `the weaker of coverage (${formatMultiple(r.interestCoverage)}) and leverage (${formatMultiple(r.debtToEbitda)} EBITDA)` +
        (governanceScore > 0
          ? `, cut ${formatPercent((0.5 * Math.min(governanceScore, 100)) / 100)} by governance debt (${Math.round(governanceScore)}/100)`
          : "");

  return {
    title: `Why is economics ${formatScore(score.economics)}?`,
    summary: "Economics blends how much value the decision creates with how well the company could absorb a shock.",
    steps: [
      { text: `Value scores ${formatScore(value)}: enterprise value ${formatMoney(r.enterpriseValue)} vs ${formatMoney(today.enterpriseValue)} today (50 = unchanged).` },
      { text: `Resilience scores ${formatScore(resilience)}: ${resilienceReason}.` },
      { text: `60% × ${formatScore(value)} + 40% × ${formatScore(resilience)} = ${formatScore(score.economics)}.` },
    ],
    drivers: attribute(
      baseline,
      scenario,
      (s) => scoreScenario(baseline, s, governanceScore, priorities).economics,
      POINTS,
    ),
  };
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function explainAlignment(
  baseline: Baseline,
  scenario: Scenario,
  governanceScore = 0,
  priorities: Priorities = DEFAULT_PRIORITIES,
): Explanation {
  const score = scoreScenario(baseline, scenario, governanceScore, priorities);
  const supports = score.stakeholders;
  const mean = supports.reduce((sum, s) => sum + s.support, 0) / supports.length;
  const heirsCount = score.heirs.length > 1 || score.heirs.some((h) => !h.active);
  // The gap is measured across seats: each heir sits on their own, as in scoreScenario.
  type Seat = { label: string; support: number; concerns: () => ReturnType<typeof contributions> };
  const seats: Seat[] = [
    ...supports
      .filter((s) => s.id !== "nextGen")
      .map((s) => ({ label: `the ${s.label}`, support: s.support, concerns: () => contributions(s.id, score.subScores, priorities) })),
    ...score.heirs.map((h) => ({
      label: heirsCount ? h.name : `the ${STAKEHOLDER_LABELS.nextGen}`,
      support: h.support,
      concerns: () => contributionsFrom(heirPriorities(h, priorities), score.subScores),
    })),
  ];
  const highest = seats.reduce((a, b) => (b.support > a.support ? b : a));
  const lowest = seats.reduce((a, b) => (b.support < a.support ? b : a));
  const spread = highest.support - lowest.support;
  const nextGen = supports.find((s) => s.id === "nextGen")!;
  const passive = score.heirs.filter((h) => !h.active).map((h) => h.name);

  const steps: ExplanationStep[] = [
    { text: `Support: ${supports.map((s) => `${s.label} ${formatScore(s.support)}`).join(" · ")}.` },
    ...(heirsCount
      ? [
          {
            text: `${STAKEHOLDER_LABELS.nextGen} support is each heir's, weighted by stake: ${score.heirs
              .map((h) => `${h.name} ${formatPercent(h.share)} × ${formatScore(h.support)}`)
              .join(" + ")} = ${formatScore(nextGen.support)}.`,
          },
          ...(passive.length && (priorities.nextGen.succession ?? 0) > 0
            ? [{ text: `${passive.join(" and ")} ${passive.length > 1 ? "don't" : "doesn't"} work in the business, so the weight the next generation puts on succession counts as cash to shareholders instead.` }]
            : []),
        ]
      : []),
    { text: `Average support is ${formatScore(mean)}.` },
    spread > 0.05
      ? { text: `${capitalize(highest.label)} (${formatScore(highest.support)}) and ${lowest.label} (${formatScore(lowest.support)}) are ${formatScore(spread)} points apart${heirsCount ? ", counting each heir separately" : ""}.`, tone: spread >= 40 ? "critical" : spread >= 20 ? "caution" : undefined }
      : { text: "Every stakeholder sees it the same way.", tone: "positive" },
    { text: `Alignment = ${formatScore(mean)} − half the gap (${formatScore(spread / 2)}) = ${formatScore(score.alignment)}.` },
  ];

  // What the least-supportive seat weighs most heavily.
  const topConcern = lowest.concerns().sort((a, b) => b.weight - a.weight)[0];
  if (spread > 0.05 && topConcern) {
    steps.push({
      text: `Fastest way to raise consensus: address what ${lowest.label} cares about most, ${topConcern.label.toLowerCase()}.`,
    });
  }

  return {
    title: `Why is alignment ${formatScore(score.alignment)}?`,
    summary: "Alignment is average stakeholder support, penalized by how far apart the most and least supportive stakeholders are.",
    steps,
    drivers: attribute(
      baseline,
      scenario,
      (s) => scoreScenario(baseline, s, governanceScore, priorities).alignment,
      POINTS,
    ),
  };
}
