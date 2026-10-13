import { MAX_GOVERNANCE_DISCOUNT, governanceDebtValue, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { GOVERNANCE_CAUTION, GOVERNANCE_CRITICAL } from "../simulator/engine";
import { formatMoney, formatPercent } from "../simulator/format";
import type { Explanation, ExplanationStep } from "./types";

/** "9" or "4.5": points stay readable without trailing zeros. */
const points = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const tone = (share: number): ExplanationStep["tone"] =>
  share * 100 >= GOVERNANCE_CRITICAL ? "critical" : share * 100 >= GOVERNANCE_CAUTION ? "caution" : "positive";

export function explainGovernance(answers: GovernanceAnswers, enterpriseValue: number): Explanation {
  const g = scoreGovernance(answers);
  const atRisk = governanceDebtValue(enterpriseValue, g.score);
  const title = `Why is the Governance Debt Score ${Math.round(g.score)}/100?`;
  const summary = "Each missing practice adds points; points become a valuation discount a buyer or lender would apply.";

  if (g.score <= 0) {
    return {
      title,
      summary,
      steps: [{ text: "No gaps: every practice is in place, so no governance discount applies.", tone: "positive" }],
    };
  }

  const gaps = g.items.filter((i) => i.points > 0).sort((a, b) => b.points - a.points).slice(0, 3);
  return {
    title,
    summary,
    steps: [
      ...g.categories.map((c) => ({
        text: `${c.label}: ${points(c.points)} of ${c.maxPoints} points.`,
        tone: tone(c.maxPoints > 0 ? c.points / c.maxPoints : 0),
      })),
      {
        text: `Biggest gaps: ${gaps.map((i) => `${i.label.toLowerCase()} (${points(i.points)} pts, ${formatMoney(governanceDebtValue(enterpriseValue, i.points))})`).join("; ")}.`,
      },
      { text: `Total: ${points(g.score)} points = a score of ${Math.round(g.score)}/100.` },
      {
        text: `Value at risk: ${formatMoney(Math.max(enterpriseValue, 0))} × ${formatPercent(MAX_GOVERNANCE_DISCOUNT)} × ${points(g.score)}/100 = ${formatMoney(atRisk)}.`,
        tone: tone(g.score / 100),
      },
    ],
    note: `Buyers and lenders discount informal governance by up to ${formatPercent(MAX_GOVERNANCE_DISCOUNT)} of enterprise value. The same score also weakens resilience in the matrix and raises crisis odds in Fork the Future.`,
  };
}
