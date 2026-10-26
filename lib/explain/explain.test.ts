import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GOVERNANCE, DEMO_GOVERNANCE } from "../governance/model";
import { DEFAULT_PROJECTION_INPUTS, project } from "../projection/model";
import { runShock } from "../redteam/shocks";
import { scoreScenario } from "../simulator/alignment";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import { formatMoney, formatMultiple } from "../simulator/format";
import type { Scenario } from "../simulator/types";
import { INTERACTION_LABEL, attribute } from "./attribution";
import { explainForkLead } from "./fork";
import { explainGovernance } from "./governance";
import { explainAlignment, explainEconomics } from "./matrix";
import { explainShock } from "./redteam";
import { explainCoverage, explainDistribution, explainEnterpriseValue, explainEquity } from "./simulator";
import type { Explanation } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const sc = (patch: Partial<Scenario> = {}): Scenario => ({ ...neutral, ...patch });
const text = (e: Explanation) => e.steps.map((s) => s.text);
const recap = sc({ leverage: 3 });

// Expected text is hand-calculated for the demo company.
describe("simulator explainers", () => {
  it("explains enterprise value as EBITDA × multiple, with no drivers when nothing changed", () => {
    const e = explainEnterpriseValue(base, neutral);
    expect(e.title).toBe("Why is enterprise value $96.0M?");
    expect(text(e)).toContain("$12.0M × 8.0x = $96.0M enterprise value.");
    expect(e.drivers).toEqual([]);
  });

  it("explains the outside CEO and a market shift in enterprise value", () => {
    const e = explainEnterpriseValue(base, sc({ outsideCeo: true, multipleShock: -0.2 }));
    expect(text(e).join(" ")).toContain("adjusted EBITDA is $11.4M");
    expect(text(e).join(" ")).toContain("−20% market shift makes it 6.4x");
  });

  it("explains equity after a dividend recap, driven entirely by leverage", () => {
    const e = explainEquity(base, recap);
    expect(text(e)).toEqual([
      "Enterprise value is $96.0M.",
      "Debt is 3.0x × $12.0M EBITDA = $36.0M.",
      "$96.0M − $36.0M = $60.0M equity.",
      "Founder 80% = $48.0M · Other shareholders 20% = $12.0M",
    ]);
    expect(e.drivers).toEqual([
      { lever: "Debt leverage 3.0x", effect: -30, display: "−$30.0M", tone: "critical" },
    ]);
  });

  it("calls out underwater equity", () => {
    const e = explainEquity(base, sc({ leverage: 6, multipleShock: -0.4 }));
    expect(e.steps.at(-1)).toMatchObject({ tone: "critical" });
    expect(text(e).at(-1)).toContain("underwater");
  });

  it("explains a dividend recap and who receives it", () => {
    const e = explainDistribution(base, recap);
    expect(e.title).toBe("Why are shareholders paid $30.0M?");
    expect(text(e)).toEqual([
      "Debt rises from $6.0M today to $36.0M.",
      "The extra $30.0M is paid out to shareholders as a dividend recap.",
      "Founder $24.0M · Other shareholders $6.0M",
    ]);
    expect(e.note).toContain("unchanged today");
  });

  it("explains capital required to deleverage, and no change", () => {
    expect(explainDistribution(base, sc({ leverage: 0 })).title).toBe("Why must shareholders put in $6.0M?");
    expect(text(explainDistribution(base, neutral))).toEqual(["Debt stays at $6.0M, exactly where it is today."]);
  });

  it("explains coverage step by step", () => {
    const e = explainCoverage(base, recap);
    expect(e.title).toBe("Why is interest coverage 4.2x?");
    expect(text(e).slice(0, 2)).toEqual([
      "Interest is $36.0M × 8% = $2.9M a year.",
      "$12.0M EBITDA ÷ $2.9M = 4.2x coverage.",
    ]);
    expect(e.steps.at(-1)?.tone).toBe("positive");
    expect(e.drivers?.[0]).toMatchObject({ lever: "Debt leverage 3.0x", display: "−20.8x", tone: "critical" });
  });

  it("explains coverage with no debt, without drivers", () => {
    const e = explainCoverage(base, sc({ leverage: 0 }));
    expect(text(e)).toEqual(["There is no debt, so there is no interest to cover."]);
    expect(e.drivers).toBeUndefined();
  });

  it("quotes headline numbers exactly as the engine reports them", () => {
    for (const s of [neutral, recap, sc({ leverage: 4.5, multipleShock: -0.3, outsideCeo: true, equityTransfer: 0.6 })]) {
      const r = simulate(base, s);
      expect(explainEnterpriseValue(base, s).title).toContain(formatMoney(r.enterpriseValue));
      expect(explainEquity(base, s).title).toContain(formatMoney(r.equityValue));
      expect(explainCoverage(base, s).title).toContain(formatMultiple(r.interestCoverage));
    }
  });
});

describe("attribution", () => {
  const everything = sc({ leverage: 3, equityTransfer: 0.5, multipleShock: -0.2, outsideCeo: true });
  const equity = (s: Scenario) => simulate(base, s).equityValue;

  it("accounts for the whole change from today, interactions included", () => {
    for (const metric of [equity, (s: Scenario) => scoreScenario(base, s, 78).alignment]) {
      const drivers = attribute(base, everything, metric, { format: String });
      const total = metric(everything) - metric(neutral);
      expect(drivers.reduce((sum, d) => sum + d.effect, 0)).toBeCloseTo(total, 9);
    }
  });

  it("reports interactions separately when levers compound", () => {
    // A valuation shift and an outside CEO multiply each other's effect on enterprise value.
    const drivers = attribute(base, sc({ multipleShock: -0.2, outsideCeo: true }), (s) => simulate(base, s).enterpriseValue, { format: String });
    expect(drivers.map((d) => d.lever)).toContain(INTERACTION_LABEL);
  });

  it("gives a single lever the whole change, with no interaction row", () => {
    const drivers = attribute(base, recap, equity, { format: String });
    expect(drivers).toHaveLength(1);
    expect(drivers[0].effect).toBeCloseTo(-30);
  });

  it("returns no drivers when nothing has changed", () => {
    expect(attribute(base, neutral, equity, { format: String })).toEqual([]);
  });
});

describe("matrix explainers", () => {
  it("explains alignment for a dividend recap", () => {
    const e = explainAlignment(base, recap);
    expect(e.title).toBe("Why is alignment 27.7?");
    expect(text(e)).toContain("Average support is 53.6.");
    expect(text(e)).toContain("The Founder (79.5) and the Next-gen heir (27.7) are 51.8 points apart.");
    expect(text(e)).toContain("Alignment = 53.6 − half the gap (25.9) = 27.7.");
    expect(text(e).at(-1)).toContain("next-gen succession");
  });

  it("explains economics as value and resilience, including the governance drag", () => {
    const e = explainEconomics(base, neutral, 78);
    expect(e.title).toBe("Why is economics 54.4?");
    expect(text(e)[1]).toContain("cut 39% by governance debt (78/100)");
    expect(text(e)).toContain("60% × 50.0 + 40% × 61.0 = 54.4.");
  });
});

describe("governance explainer", () => {
  it("itemizes the demo company's 78 points and $22.5M at risk", () => {
    const e = explainGovernance(DEMO_GOVERNANCE, 96);
    expect(text(e).slice(0, 3)).toEqual([
      "Undocumented authority: 29 of 35 points.",
      "Missing board seats: 25 of 35 points.",
      "Informal voting rules: 24 of 30 points.",
    ]);
    expect(text(e)[3]).toBe(
      "Biggest gaps: delegation of authority documented (12 pts, $3.5M); independent directors (12 pts, $3.5M); incapacitation plan (11 pts, $3.2M).",
    );
    expect(text(e)).toContain("Value at Risk: $96.0M × 30% × 78/100 = $22.5M.");
  });

  it("reports no gaps at best practice", () => {
    expect(text(explainGovernance(BEST_PRACTICE_GOVERNANCE, 96))[0]).toMatch(/^No gaps/);
  });
});

describe("fork explainer", () => {
  const asIs = project(base, neutral, 78, DEFAULT_PROJECTION_INPUTS);
  const fixed = project(base, neutral, 0, DEFAULT_PROJECTION_INPUTS);
  const labels = { a: "Today", b: "Today + governance fixed" };

  it("splits the 10-year lead into equity, governance losses and cash", () => {
    const e = explainForkLead(asIs, fixed, labels, 10);
    const lead = fixed[10].shareholderValue - asIs[10].shareholderValue;
    expect(e.title).toBe("Why is B ahead at year 10?");
    expect(text(e)[0]).toContain("(+$0.0M for B)"); // same scenario: same equity
    expect(text(e)[3]).toContain(`is ahead by ${formatMoney(lead)}`);
  });

  it("reconciles A's Expected Loss with Value at Risk", () => {
    const step = text(explainForkLead(asIs, fixed, labels, 10)).find((t) => t.startsWith("A's Expected Loss"));
    expect(step).toContain(
      `× 30% maximum governance discount × ${(asIs[10].disruptionProbability * 100).toFixed(1)}% chance of a crisis by year 10 = ${formatMoney(asIs[10].expectedGovernanceLoss)}`,
    );
    expect(step).toContain("Value at Risk uses the same discount scaled by the Governance Debt Score");
  });

  it("splits the lead exactly when one branch is underwater", () => {
    const deep = project({ ...base, multiple: 3 }, { ...neutral, leverage: 6 }, 78, DEFAULT_PROJECTION_INPUTS);
    expect(deep[1].equityValue).toBeLessThan(0);
    expect(text(explainForkLead(deep, fixed, labels, 1))[0]).toContain("equity below zero counts as zero");
    const lead = fixed[1].shareholderValue - deep[1].shareholderValue;
    const parts =
      fixed[1].ownersEquity - deep[1].ownersEquity -
      (fixed[1].expectedGovernanceLoss - deep[1].expectedGovernanceLoss) +
      (fixed[1].cumulativeCash - deep[1].cumulativeCash);
    expect(parts).toBeCloseTo(lead, 9);
  });

  it("calls identical branches even", () => {
    expect(explainForkLead(asIs, asIs, labels, 10).title).toBe("Why are the branches even at year 10?");
  });
});

describe("red team explainer", () => {
  it("explains why the demo survives founder incapacitation and what governance would save", () => {
    const e = explainShock(runShock(base, neutral, DEMO_GOVERNANCE, "incapacitation"));
    expect(e.title).toBe("Why the company survives founder incapacitation");
    expect(text(e)[0]).toBe("The shock: EBITDA −17.4% · multiple −17.4%.");
    expect(text(e).join(" ")).toContain("saving $21.2M");
    expect(e.note).toMatch(/Control vacuum/);
  });

  it("names the breached threshold when a shock breaks the company", () => {
    const e = explainShock(runShock(base, sc({ leverage: 5 }), DEMO_GOVERNANCE, "downturn"));
    expect(e.title).toBe("Why the company breaks economic downturn");
    expect(e.steps.find((s) => s.tone === "critical")?.text).toContain("debt exceeds 5.0x EBITDA");
  });
});
