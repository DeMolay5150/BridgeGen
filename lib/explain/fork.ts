import { MAX_GOVERNANCE_DISCOUNT } from "../governance/model";
import type { YearPoint } from "../projection/types";
import { formatMoney, formatPercent, formatSignedMoney as signed } from "../simulator/format";
import type { Explanation, ExplanationStep } from "./types";

/** Leads under $50K are a tie. */
const TIE = 0.05;

/** How one branch's Expected Loss is built, and how it relates to the score-based Value at Risk. */
function expectedLossStep(name: string, p: YearPoint, year: number): ExplanationStep {
  return {
    text: `${name}'s Expected Loss: ${formatMoney(p.enterpriseValue)} enterprise value × ${formatPercent(MAX_GOVERNANCE_DISCOUNT)} maximum governance discount × ${formatPercent(p.disruptionProbability, 1)} chance of a crisis by year ${year} = ${formatMoney(p.expectedGovernanceLoss)}. Value at Risk uses the same discount scaled by the Governance Debt Score instead of the chance of a crisis.`,
  };
}

/**
 * Why one branch leads at a horizon. Shareholder value = owners' equity −
 * Expected Loss + cash paid out, so the lead splits exactly into those three.
 */
export function explainForkLead(
  a: YearPoint[],
  b: YearPoint[],
  labels: { a: string; b: string },
  year: number,
): Explanation {
  const pa = a[year];
  const pb = b[year];
  const lead = pb.shareholderValue - pa.shareholderValue;
  const title = `Why ${Math.abs(lead) < TIE ? "are the branches even" : `is ${lead > 0 ? "B" : "A"} ahead`} at year ${year}?`;
  const summary = "Shareholder value = owners' equity − Expected Loss from governance + all cash paid out so far.";

  if (Math.abs(lead) < TIE) {
    return { title, summary, steps: [{ text: `Both branches reach ${formatMoney(pa.shareholderValue)} by year ${year}.` }] };
  }

  const equity = pb.ownersEquity - pa.ownersEquity;
  const loss = pb.expectedGovernanceLoss - pa.expectedGovernanceLoss;
  const cash = pb.cumulativeCash - pa.cumulativeCash;
  const interest = (points: YearPoint[]) =>
    points.slice(1, year + 1).reduce((sum, p) => sum + p.interest, 0);
  const extraInterest = interest(b) - interest(a);
  const leader = lead > 0 ? `B (${labels.b})` : `A (${labels.a})`;
  const tone = (n: number): ExplanationStep["tone"] => (Math.abs(n) < TIE ? undefined : n > 0 ? "positive" : "critical");
  const underwater = pa.equityValue < 0 || pb.equityValue < 0;

  const steps: ExplanationStep[] = [
    {
      text: `Owners' equity: B ${formatMoney(pb.ownersEquity)} vs A ${formatMoney(pa.ownersEquity)} (${signed(equity)} for B)${underwater ? "; equity below zero counts as zero, since owners don't repay the debt" : ""}.`,
      tone: tone(equity),
    },
    { text: `Expected Loss: B ${formatMoney(pb.expectedGovernanceLoss)} vs A ${formatMoney(pa.expectedGovernanceLoss)} (${signed(-loss)} for B).`, tone: tone(-loss) },
    { text: `Cash paid out to date: B ${formatMoney(pb.cumulativeCash)} vs A ${formatMoney(pa.cumulativeCash)} (${signed(cash)} for B).`, tone: tone(cash) },
    { text: `${signed(equity)} ${signed(-loss)} ${signed(cash)} = ${signed(lead)}: ${leader} is ahead by ${formatMoney(Math.abs(lead))}.` },
  ];
  for (const [name, p] of [["A", pa], ["B", pb]] as const) {
    if (p.expectedGovernanceLoss >= TIE) steps.push(expectedLossStep(name, p, year));
  }
  if (Math.abs(extraInterest) >= TIE) {
    steps.push({
      text: `Over ${year} years, B pays ${formatMoney(Math.abs(extraInterest))} ${extraInterest > 0 ? "more" : "less"} interest than A.`,
      tone: extraInterest > 0 ? "caution" : undefined,
    });
  }

  return {
    title,
    summary,
    steps,
    note: "Cash flows come from the three-statement model (tax, capex, working capital, scheduled debt repayment). Values are not discounted: a dollar in year 10 counts the same as a dollar today.",
  };
}
