import { describeChanges } from "../redteam/describe";
import type { ShockResult } from "../redteam/types";
import {
  COVERAGE_CAUTION,
  COVERAGE_CRITICAL,
  LEVERAGE_CAUTION,
  LEVERAGE_CRITICAL,
} from "../simulator/engine";
import { formatMoney, formatMultiple } from "../simulator/format";
import type { Explanation, ExplanationStep } from "./types";

const VERDICT_WORD = { survives: "survives", strained: "is strained", breaks: "breaks" } as const;

/** The thresholds this outcome crosses, worst first. */
function breaches(r: ShockResult): { critical: string[]; caution: string[] } {
  const { after } = r;
  const cov = after.interestCoverage;
  const lev = after.debtToEbitda;
  const critical: string[] = [];
  const caution: string[] = [];
  if (after.equityValue <= 0) critical.push("equity is wiped out");
  if (after.ebitda <= 0) critical.push("EBITDA turns negative");
  if (cov !== null && cov < COVERAGE_CRITICAL) critical.push(`coverage falls below ${formatMultiple(COVERAGE_CRITICAL)}`);
  else if (cov !== null && cov < COVERAGE_CAUTION) caution.push(`coverage falls below ${formatMultiple(COVERAGE_CAUTION)}`);
  if (lev !== null && lev > LEVERAGE_CRITICAL) critical.push(`debt exceeds ${formatMultiple(LEVERAGE_CRITICAL)} EBITDA`);
  else if (lev !== null && lev >= LEVERAGE_CAUTION) caution.push(`debt reaches ${formatMultiple(LEVERAGE_CAUTION)} EBITDA`);
  return { critical, caution };
}

export function explainShock(r: ShockResult): Explanation {
  const { before, after, changes } = r;
  const steps: ExplanationStep[] = [
    { text: `The shock: ${describeChanges(changes)}.` },
    { text: `EBITDA ${formatMoney(before.ebitda)} → ${formatMoney(after.ebitda)}; enterprise value ${formatMoney(before.enterpriseValue)} → ${formatMoney(after.enterpriseValue)}.` },
  ];
  if (changes.extraDebt > 0) {
    steps.push({ text: `Debt ${formatMoney(before.debt)} → ${formatMoney(after.debt)} to fund the heir buyout.` });
  }
  steps.push({ text: `Equity ${formatMoney(before.equityValue)} → ${formatMoney(after.equityValue)}; coverage ${formatMultiple(before.interestCoverage)} → ${formatMultiple(after.interestCoverage)}.` });

  const { critical, caution } = breaches(r);
  steps.push(
    r.verdict === "breaks"
      ? { text: `It breaks because ${critical.join(" and ")}.`, tone: "critical" }
      : r.verdict === "strained"
        ? { text: `It is strained because ${caution.join(" and ")}.`, tone: "caution" }
        : {
            text: `It survives: coverage stays at or above ${formatMultiple(COVERAGE_CAUTION)} and debt below ${formatMultiple(LEVERAGE_CAUTION)} EBITDA.`,
            tone: "positive",
          },
  );
  if (r.valueDestroyed > 0.05) {
    steps.push({ text: `Value destroyed: ${formatMoney(r.valueDestroyed)} of equity (an heir buyout is a transfer, not a loss).` });
  }
  if (r.dividend && r.dividend.valueSaved > 0.05) {
    steps.push({
      text: `With best-practice governance the shock would be ${describeChanges(r.dividend.changes)}, saving ${formatMoney(r.dividend.valueSaved)}.`,
      tone: "positive",
    });
  }

  return {
    title: `Why the company ${VERDICT_WORD[r.verdict]} ${r.name.toLowerCase()}`,
    summary: r.description,
    steps,
    note: r.warnings.length ? r.warnings.join(" ") : undefined,
  };
}
