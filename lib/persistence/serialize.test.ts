import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES } from "../simulator/alignment";
import { selectSnapshot, useSimulatorStore } from "../simulator/store";
import { defaultSnapshot, fromRow, toRow, type CompanySnapshot } from "./serialize";

const custom: CompanySnapshot = {
  ...defaultSnapshot(),
  baseline: { revenue: 75, ebitda: 18, multiple: 7, existingDebt: 20, interestRate: 0.065, founderOwnership: 0.6 },
  scenario: { leverage: 2.5, equityTransfer: 0.3, multipleShock: -0.1, outsideCeo: true, ceoCost: 2, ceoUplift: 0.08 },
  governance: { ...defaultSnapshot().governance, votingRules: "yes", boardSeatsFilled: 4 },
  fork: { a: { source: "dividend-recap", fixGovernance: true }, b: { source: "current", fixGovernance: false }, assumptions: { ebitdaGrowth: 0.06, cashConversion: 0.4 }, statements: { ...defaultSnapshot().fork.statements, taxRate: 0.3, capex: 0.05 } },
  priorities: { ...DEFAULT_PRIORITIES, lender: { ...DEFAULT_PRIORITIES.lender, resilience: 20 } },
};

describe("company serialization", () => {
  it("round-trips a snapshot through a row", () => {
    expect(fromRow(toRow(custom))).toEqual(custom);
  });

  it("fills a brand-new (empty) row with the demo company", () => {
    expect(fromRow({ baseline: {}, scenario: {}, governance: {}, fork: {}, priorities: {} })).toEqual(defaultSnapshot());
  });

  it("keeps saved values and fills fields added since the row was saved", () => {
    const legacy = fromRow({
      baseline: { ebitda: 30 },
      scenario: { equityTransfer: 0.5 },
      governance: { votingRules: "yes" },
      fork: { assumptions: { ebitdaGrowth: 0.02 } },
      priorities: { founder: { control: 1 } },
    });
    expect(legacy.baseline).toEqual({ ...defaultSnapshot().baseline, ebitda: 30 });
    // Leverage re-anchors to the saved baseline: $6M debt on $30M EBITDA.
    expect(legacy.scenario.leverage).toBeCloseTo(0.2);
    expect(legacy.scenario.equityTransfer).toBe(0.5);
    expect(legacy.governance.votingRules).toBe("yes");
    expect(legacy.fork.assumptions).toEqual({ ebitdaGrowth: 0.02, cashConversion: 0.5 });
    // Rows saved before the three-statement inputs were persisted get the defaults.
    expect(legacy.fork.statements).toEqual(defaultSnapshot().fork.statements);
    expect(legacy.priorities.founder).toEqual({ ...DEFAULT_PRIORITIES.founder, control: 1 });
    expect(legacy.priorities.lender).toEqual(DEFAULT_PRIORITIES.lender);
  });

  it("keeps valid three-statement inputs and drops invalid ones", () => {
    const s = fromRow({ baseline: {}, scenario: {}, governance: {}, fork: { statements: { taxRate: 0.35 } }, priorities: {} });
    expect(s.fork.statements).toEqual({ ...defaultSnapshot().fork.statements, taxRate: 0.35 });
    const bad = fromRow({ baseline: {}, scenario: {}, governance: {}, fork: { statements: { taxRate: "high" } }, priorities: {} });
    expect(bad.fork.statements).toEqual(defaultSnapshot().fork.statements);
  });

  it("falls back to defaults for corrupt sections instead of crashing", () => {
    const s = fromRow({
      baseline: { ebitda: "lots" },
      scenario: null,
      governance: { votingRules: "maybe" },
      fork: "nope",
      priorities: { founder: { control: Infinity } },
    });
    expect(s).toEqual(defaultSnapshot());
  });

  it("drops one bad field without wiping the rest of its section", () => {
    // NaN is saved as null in JSON; it must not reset the company to the demo figures.
    const s = fromRow({
      baseline: { revenue: 75, ebitda: null, founderOwnership: 0.6 },
      scenario: { equityTransfer: 0.4, ceoCost: "x" },
      governance: { votingRules: "yes", boardSeatsFilled: Number.NaN },
      fork: { a: { source: "dividend-recap" }, b: { source: "current", fixGovernance: true }, statements: { taxRate: 0.3, capex: null } },
      priorities: { founder: { control: 2, value: Infinity }, stranger: { control: 1 } },
    });
    const d = defaultSnapshot();
    expect(s.baseline).toEqual({ ...d.baseline, revenue: 75, founderOwnership: 0.6 });
    expect(s.scenario.equityTransfer).toBe(0.4);
    expect(s.scenario.ceoCost).toBe(d.scenario.ceoCost);
    expect(s.governance).toEqual({ ...d.governance, votingRules: "yes" });
    // A branch missing a required field is dropped whole, never half-kept.
    expect(s.fork.a).toEqual(d.fork.a);
    expect(s.fork.b).toEqual({ source: "current", fixGovernance: true });
    expect(s.fork.statements).toEqual({ ...d.fork.statements, taxRate: 0.3 });
    expect(s.priorities.founder).toEqual({ ...DEFAULT_PRIORITIES.founder, control: 2 });
    expect(Object.keys(s.priorities)).not.toContain("stranger");
  });
});

describe("store: saved companies", () => {
  beforeEach(() => useSimulatorStore.getState().exitToDemo());
  const state = () => useSimulatorStore.getState();

  it("loads a company and exposes its snapshot", () => {
    state().loadCompany({ id: "c1", name: "Acme Family Holdings", snapshot: custom });
    expect(state().companyId).toBe("c1");
    expect(state().companyName).toBe("Acme Family Holdings");
    expect(selectSnapshot(state())).toEqual(custom);
  });

  it("resets only the levers for a saved company, never its figures", () => {
    state().loadCompany({ id: "c1", name: "Acme", snapshot: custom });
    state().reset();
    expect(state().baseline).toEqual(custom.baseline);
    expect(state().governance).toEqual(custom.governance);
    expect(state().scenario.equityTransfer).toBe(0);
    expect(state().scenario.leverage).toBeCloseTo(20 / 18);
  });

  it("returns to the demo company on exit", () => {
    state().loadCompany({ id: "c1", name: "Acme", snapshot: custom });
    state().exitToDemo();
    expect(state().companyId).toBeNull();
    expect(selectSnapshot(state())).toEqual(defaultSnapshot());
  });
});
