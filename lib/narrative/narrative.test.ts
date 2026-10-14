import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GOVERNANCE, DEMO_GOVERNANCE, governanceDebtValue, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { breakingPoints } from "../redteam/breaking";
import { SHOCKS, runShock } from "../redteam/shocks";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import { formatMoney } from "../simulator/format";
import type { Scenario } from "../simulator/types";
import { governanceBrief } from "./governance";
import { redTeamBrief } from "./redteam";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const ev = simulate(base, neutral).enterpriseValue;

function brief(scenario: Scenario, governance: GovernanceAnswers = DEMO_GOVERNANCE) {
  const shocks = SHOCKS.map((s) => runShock(base, scenario, governance, s.id));
  return redTeamBrief(
    shocks,
    breakingPoints(simulate(base, scenario), base.interestRate),
    breakingPoints(simulate(base, neutral), base.interestRate),
  );
}

// Expected text is hand-calculated for the demo company ($96.0M EV, 78/100 governance debt).
describe("governance brief", () => {
  it("leads with the priced discount for the demo company", () => {
    const b = governanceBrief(DEMO_GOVERNANCE, ev);
    expect(b.tone).toBe("critical");
    expect(b.headline).toBe(
      "Governance debt of 78/100 is a material diligence finding: a buyer or lender would price in $22.5M (23.4% of enterprise value).",
    );
    expect(b.findings).toContain("Each point of governance debt costs $288.0K at the current enterprise value of $96.0M.");
  });

  it("recommends the three largest gaps, largest first, with values that match the calculator", () => {
    const b = governanceBrief(DEMO_GOVERNANCE, ev);
    const top = scoreGovernance(DEMO_GOVERNANCE).items.filter((i) => i.points > 0).sort((a, c) => c.points - a.points).slice(0, 3);
    expect(b.actions).toHaveLength(3);
    b.actions.forEach((action, i) => expect(action).toContain(`recovers ${formatMoney(governanceDebtValue(ev, top[i].points))}`));
    expect(b.actions[0]).toBe("Document a delegation-of-authority matrix: recovers $3.5M.");
  });

  it("calls best-practice governance diligence-ready with no discount", () => {
    const b = governanceBrief(BEST_PRACTICE_GOVERNANCE, ev);
    expect(b.tone).toBe("positive");
    expect(b.headline).toContain("no governance discount applies");
    expect(b.actions).toHaveLength(1);
  });

  it("softens the verdict as the score falls through the caution band", () => {
    const b = governanceBrief({ ...BEST_PRACTICE_GOVERNANCE, delegationOfAuthority: "no", successionPlan: "no", votingRules: "no" }, ev);
    expect(b.tone).toBe("caution");
    expect(b.headline).toMatch(/^Governance is a visible, negotiable discount: at 34\/100/);
  });

  it("never prices a negative enterprise value as a gain", () => {
    expect(governanceBrief(DEMO_GOVERNANCE, -50).headline).toContain("$0.0M");
  });
});

describe("red team brief", () => {
  it("calls today's demo company resilient and names the cheapest hedge", () => {
    const b = brief(neutral);
    expect(b.tone).toBe("positive");
    expect(b.headline).toBe(
      "The structure is stress-resilient: all 4 cases clear the coverage and leverage limits, with worst-case equity erosion of $63.7M in the perfect storm case.",
    );
    expect(b.findings[0]).toBe("Headroom: a 90.0% fall in EBITDA trips the first limit (debt rises above 5.0x EBITDA), unchanged from today.");
    expect(b.actions[0]).toContain("worth $21.2M in the downside");
  });

  it("flags a 4x recap as failing, with less headroom than standing still", () => {
    const b = brief({ ...neutral, leverage: 4 });
    expect(b.tone).toBe("critical");
    expect(b.headline).toBe("The structure fails 2 of 4 stress cases; the perfect storm case is the binding risk, erasing $63.7M of equity.");
    expect(b.findings[0]).toContain("a 20.0% fall in EBITDA");
    expect(b.findings[0]).toContain("versus 90.0% today");
    expect(b.actions).toContain("Re-size leverage or extend maturities: an ordinary downturn alone breaks the structure.");
    expect(b.actions.at(-1)).toBe("Revisit the decision itself: it leaves less headroom than standing still (20.0% vs. 90.0% today).");
  });

  it("drops the governance hedge once governance is best practice", () => {
    const b = brief(neutral, BEST_PRACTICE_GOVERNANCE);
    expect(b.findings.join(" ")).not.toContain("cheapest hedge");
    expect(b.actions).toEqual(["No structural action required; re-run the stress test at each refinancing or change in ownership."]);
  });

  it("reports a debt-free company as having no lender exposure", () => {
    const debtFree = { ...base, existingDebt: 0 };
    const scenario = neutralScenario(debtFree);
    const shocks = SHOCKS.map((s) => runShock(debtFree, scenario, DEMO_GOVERNANCE, s.id));
    const none = breakingPoints(simulate(debtFree, scenario), base.interestRate);
    expect(redTeamBrief(shocks, none, none).findings[0]).toBe(
      "No debt-service exposure: no fall in EBITDA or the multiple breaches a lender limit.",
    );
  });
});
