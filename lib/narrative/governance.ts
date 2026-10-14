import { MAX_GOVERNANCE_DISCOUNT, governanceDebtValue, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers, GovernanceItemScore } from "../governance/types";
import { GOVERNANCE_CAUTION, GOVERNANCE_CRITICAL } from "../simulator/engine";
import { formatMoney, formatPercent } from "../simulator/format";
import type { ExecutiveBrief } from "./types";

/** The remedy for each gap, phrased as an instruction. */
const REMEDY: Partial<Record<GovernanceItemScore["id"], string>> = {
  delegationOfAuthority: "Document a delegation-of-authority matrix",
  successionPlan: "Adopt a written CEO succession plan",
  incapacitationPlan: "Put an incapacitation plan in place (powers of attorney, key-person cover)",
  boardSeats: "Fill the vacant board seats",
  independentDirectors: "Appoint independent directors",
  meetingCadence: "Move the board to a quarterly cadence",
  buySellAgreement: "Execute a shareholder buy-sell agreement",
  votingRules: "Codify voting rights and approval thresholds",
  disputeResolution: "Establish a family council and dispute-resolution path",
};

const TOP_GAPS = 3;

/** "9" or "4.5": points stay readable without trailing zeros. */
const points = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** Executive summary of the Governance Debt Calculator, for an investment committee or lender. */
export function governanceBrief(answers: GovernanceAnswers, enterpriseValue: number): ExecutiveBrief {
  const g = scoreGovernance(answers);
  const score = Math.round(g.score);
  const atRisk = governanceDebtValue(enterpriseValue, g.score);
  const share = formatPercent((MAX_GOVERNANCE_DISCOUNT * g.score) / 100, 1);
  const gaps = g.items.filter((i) => i.points > 0).sort((a, b) => b.points - a.points);

  if (gaps.length === 0) {
    return {
      headline:
        "Governance is diligence-ready: every practice a buyer or lender screens for is in place, so no governance discount applies.",
      tone: "positive",
      findings: ["Authority, board and shareholder arrangements are all documented and operating."],
      actions: ["Re-certify the governance file annually and ahead of any refinancing or liquidity event."],
    };
  }

  const tone = score >= GOVERNANCE_CRITICAL ? "critical" : score >= GOVERNANCE_CAUTION ? "caution" : "positive";
  const exposure = `${formatMoney(atRisk)} (${share} of enterprise value)`;
  const headline =
    tone === "critical"
      ? `Governance debt of ${score}/100 is a material diligence finding: a buyer or lender would price in ${exposure}.`
      : tone === "caution"
        ? `Governance is a visible, negotiable discount: at ${score}/100, ${exposure} is exposed in any transaction or refinancing.`
        : `Governance is close to institutional grade at ${score}/100; residual exposure is ${exposure}.`;

  const weakest = [...g.categories].sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)[0];
  const top = gaps.slice(0, TOP_GAPS);
  const topPoints = top.reduce((sum, i) => sum + i.points, 0);
  const findings = [
    `${weakest.label} is the weakest area: ${points(weakest.points)} of ${weakest.maxPoints} possible points of debt.`,
    `Each point of governance debt costs ${formatMoney(governanceDebtValue(enterpriseValue, 1))} at the current enterprise value of ${formatMoney(Math.max(enterpriseValue, 0))}.`,
  ];
  if (gaps.length > top.length) {
    findings.push(
      `The ${top.length} largest gaps carry ${formatPercent(topPoints / g.score)} of the discount (${formatMoney(governanceDebtValue(enterpriseValue, topPoints))}): remediation is concentrated, not diffuse.`,
    );
  }

  return {
    headline,
    tone,
    findings,
    actions: top.map(
      (item) => `${REMEDY[item.id] ?? item.label}: recovers ${formatMoney(governanceDebtValue(enterpriseValue, item.points))}.`,
    ),
  };
}
