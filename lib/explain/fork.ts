import type { YearPoint } from "../projection/types";
import { formatMoney, formatSignedMoney as signed } from "../simulator/format";
import type { Explanation, ExplanationStep } from "./types";

/** Leads under $50K are a tie. */
const TIE = 0.05;

/**
 * Why one branch leads at a horizon. Shareholder value = equity − expected
 * governance loss + cash paid out, so the lead splits exactly into those three.
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
  const summary = "Shareholder value = equity − expected governance losses + all cash paid out so far.";

  if (Math.abs(lead) < TIE) {
    return { title, summary, steps: [{ text: `Both branches reach ${formatMoney(pa.shareholderValue)} by year ${year}.` }] };
  }

  const equity = pb.equityValue - pa.equityValue;
  const loss = pb.expectedGovernanceLoss - pa.expectedGovernanceLoss;
  const cash = pb.cumulativeCash - pa.cumulativeCash;
  const interest = (points: YearPoint[]) =>
    points.slice(1, year + 1).reduce((sum, p) => sum + p.interest, 0);
  const extraInterest = interest(b) - interest(a);
  const leader = lead > 0 ? `B (${labels.b})` : `A (${labels.a})`;
  const tone = (n: number): ExplanationStep["tone"] => (Math.abs(n) < TIE ? undefined : n > 0 ? "positive" : "critical");

  const steps: ExplanationStep[] = [
    { text: `Equity: B ${formatMoney(pb.equityValue)} vs A ${formatMoney(pa.equityValue)} (${signed(equity)} for B).`, tone: tone(equity) },
    { text: `Expected governance losses: B ${formatMoney(pb.expectedGovernanceLoss)} vs A ${formatMoney(pa.expectedGovernanceLoss)} (${signed(-loss)} for B).`, tone: tone(-loss) },
    { text: `Cash paid out to date: B ${formatMoney(pb.cumulativeCash)} vs A ${formatMoney(pa.cumulativeCash)} (${signed(cash)} for B).`, tone: tone(cash) },
    { text: `${signed(equity)} ${signed(-loss)} ${signed(cash)} = ${signed(lead)}: ${leader} is ahead by ${formatMoney(Math.abs(lead))}.` },
  ];
  if (Math.abs(extraInterest) >= TIE) {
    steps.push({
      text: `Over ${year} years, B pays ${formatMoney(Math.abs(extraInterest))} ${extraInterest > 0 ? "more" : "less"} interest than A.`,
      tone: extraInterest > 0 ? "caution" : undefined,
    });
  }

  return { title, summary, steps, note: "Values are not discounted: a dollar in year 10 counts the same as a dollar today." };
}
