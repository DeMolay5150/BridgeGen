import {
  DEFAULT_PRIORITIES,
  STAKEHOLDER_LABELS,
  contributions,
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

export function explainAlignment(
  baseline: Baseline,
  scenario: Scenario,
  governanceScore = 0,
  priorities: Priorities = DEFAULT_PRIORITIES,
): Explanation {
  const score = scoreScenario(baseline, scenario, governanceScore, priorities);
  const supports = score.stakeholders;
  const mean = supports.reduce((sum, s) => sum + s.support, 0) / supports.length;
  const highest = supports.reduce((a, b) => (b.support > a.support ? b : a));
  const lowest = supports.reduce((a, b) => (b.support < a.support ? b : a));
  const spread = highest.support - lowest.support;

  const steps: ExplanationStep[] = [
    { text: `Support: ${supports.map((s) => `${s.label} ${formatScore(s.support)}`).join(" · ")}.` },
    { text: `Average support is ${formatScore(mean)}.` },
    spread > 0.05
      ? { text: `The ${highest.label} (${formatScore(highest.support)}) and the ${lowest.label} (${formatScore(lowest.support)}) are ${formatScore(spread)} points apart.`, tone: spread >= 40 ? "critical" : spread >= 20 ? "caution" : undefined }
      : { text: "Every stakeholder sees it the same way.", tone: "positive" },
    { text: `Alignment = ${formatScore(mean)} − half the gap (${formatScore(spread / 2)}) = ${formatScore(score.alignment)}.` },
  ];

  // What the least-supportive stakeholder weighs most heavily.
  const topConcern = contributions(lowest.id, score.subScores, priorities).sort((a, b) => b.weight - a.weight)[0];
  if (spread > 0.05 && topConcern) {
    steps.push({
      text: `Fastest way to raise consensus: address what the ${STAKEHOLDER_LABELS[lowest.id]} cares about most, ${topConcern.label.toLowerCase()}.`,
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
