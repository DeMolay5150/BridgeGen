import { describe, expect, it } from "vitest";
import { explainAlignment } from "../explain/matrix";
import { DEMO_GOVERNANCE } from "../governance/model";
import { fromRow, toRow, defaultSnapshot } from "../persistence/serialize";
import { project, DEFAULT_PROJECTION_INPUTS } from "../projection/model";
import { SHOCKS, runShock } from "../redteam/shocks";
import { DEFAULT_PRIORITIES, scoreScenario } from "./alignment";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import { simulate } from "./engine";
import { DEFAULT_HEIRS, departingHeir, heirDeadlock, normalizeHeirs } from "./heirs";
import type { Baseline, Heir, Scenario } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const transfer = (equityTransfer: number): Scenario => ({ ...neutral, equityTransfer });
const heir = (name: string, share: number, active = false): Heir => ({ id: name.toLowerCase(), name, share, active });
const withHeirs = (heirs: Heir[]): Baseline => ({ ...base, heirs });
const ids = (signals: { id: string }[]) => signals.map((s) => s.id);

describe("normalizeHeirs", () => {
  it("defaults to one unnamed heir when none are set", () => {
    expect(normalizeHeirs(undefined)).toEqual(DEFAULT_HEIRS);
    expect(normalizeHeirs([])).toEqual(DEFAULT_HEIRS);
  });

  it("scales shares to sum to 1, and splits equally when none are set", () => {
    expect(normalizeHeirs([heir("Ana", 0.6), heir("Ben", 0.6)]).map((h) => h.share)).toEqual([0.5, 0.5]);
    expect(normalizeHeirs([heir("Ana", 0), heir("Ben", Number.NaN)]).map((h) => h.share)).toEqual([0.5, 0.5]);
    expect(normalizeHeirs([heir("Ana", -1), heir("Ben", 2)]).map((h) => h.share)).toEqual([0, 1]);
  });

  it("caps the list, trims names and fills blanks", () => {
    const many = Array.from({ length: 10 }, (_, i) => heir(`H${i}`, 1));
    expect(normalizeHeirs(many)).toHaveLength(6);
    expect(normalizeHeirs([{ id: "x", name: "   ", share: 1, active: true }])[0].name).toBe("Heir 1");
  });
});

// The ADR's compatibility promise: companies saved before heirs existed simulate identically.
describe("saved companies without heirs", () => {
  const scenarios: Scenario[] = [neutral, transfer(0.5), transfer(1), { ...neutral, leverage: 5, equityTransfer: 0.8 }];

  it("simulate exactly as with the single default heir", () => {
    for (const scenario of scenarios) {
      expect(simulate(base, scenario, 78)).toEqual(simulate(withHeirs(DEFAULT_HEIRS), scenario, 78));
      expect(scoreScenario(base, scenario, 78)).toEqual(scoreScenario(withHeirs(DEFAULT_HEIRS), scenario, 78));
    }
  });

  it("run every stress test and projection exactly as before", () => {
    const legacy = fromRow({ baseline: { ebitda: 12 }, scenario: { equityTransfer: 0.7 }, governance: {}, fork: {}, priorities: {} });
    expect(legacy.baseline.heirs).toBeUndefined();
    for (const s of SHOCKS) {
      expect(runShock(legacy.baseline, legacy.scenario, DEMO_GOVERNANCE, s.id)).toEqual(
        runShock(withHeirs(DEFAULT_HEIRS), legacy.scenario, DEMO_GOVERNANCE, s.id),
      );
    }
    expect(project(legacy.baseline, legacy.scenario, 78, DEFAULT_PROJECTION_INPUTS)).toEqual(
      project(withHeirs(DEFAULT_HEIRS), legacy.scenario, 78, DEFAULT_PROJECTION_INPUTS),
    );
  });
});

describe("heir holdings", () => {
  it("split the next generation's ownership, equity and recap cash by share", () => {
    const r = simulate(withHeirs([heir("Ana", 3, true), heir("Ben", 1)]), { ...transfer(0.5), leverage: 3 });
    const [ana, ben] = r.heirs;
    expect(ana.ownership).toBeCloseTo(0.3);
    expect(ben.ownership).toBeCloseTo(0.1);
    expect(ana.ownership + ben.ownership).toBeCloseTo(r.ownership.nextGen, 12);
    expect(ana.equity + ben.equity).toBeCloseTo(r.holderEquity.nextGen, 12);
    expect(ana.distribution + ben.distribution).toBeCloseTo(r.holderDistribution.nextGen, 12);
  });
});

describe("control signals", () => {
  it("names the heir who out-owns the founder", () => {
    // 70% transferred: founder 24%, Ana 42%, Ben 14%.
    const r = simulate(withHeirs([heir("Ana", 0.75), heir("Ben", 0.25)]), transfer(0.7));
    const shift = r.signals.find((s) => s.id === "control-shift");
    expect(shift?.detail).toMatch(/^Ana \(42%\) now holds more equity than the founder \(24%\)/);
    expect(shift?.detail).not.toContain("Ben");
  });

  it("flags a bloc when the heirs together, but none alone, out-own the founder", () => {
    // 60% transferred: founder 32%, three heirs 16% each.
    const r = simulate(withHeirs([heir("Ana", 1), heir("Ben", 1), heir("Cy", 1)]), transfer(0.6));
    expect(ids(r.signals)).toContain("heirs-bloc");
    expect(ids(r.signals)).not.toContain("control-shift");
  });

  it("warns of deadlock when the two largest heirs tie without a majority", () => {
    const r = simulate(withHeirs([heir("Ana", 0.5), heir("Ben", 0.5)]), transfer(1));
    expect(heirDeadlock(r.heirs)?.map((h) => h.name)).toEqual(["Ana", "Ben"]);
    expect(r.signals.find((s) => s.id === "heir-deadlock")?.detail).toContain("Ana and Ben hold equal stakes (40% each)");
  });

  it("sees no deadlock when one heir leads", () => {
    const r = simulate(withHeirs([heir("Ana", 0.6), heir("Ben", 0.4)]), transfer(1));
    expect(ids(r.signals)).not.toContain("heir-deadlock");
  });
});

describe("successor exit", () => {
  const governance = DEMO_GOVERNANCE;

  it("buys out the largest heir who works in the business", () => {
    const r = simulate(withHeirs([heir("Ana", 0.6), heir("Ben", 0.4, true)]), transfer(1));
    expect(departingHeir(r.heirs)?.name).toBe("Ben");
    const one = runShock(withHeirs([heir("Ben", 1, true)]), transfer(0.4), governance, "successorExit");
    const two = runShock(withHeirs([heir("Ana", 0.6), heir("Ben", 0.4, true)]), transfer(1), governance, "successorExit");
    // Ben holds 32% either way: the same buyout.
    expect(two.changes.extraDebt).toBeCloseTo(one.changes.extraDebt, 9);
    expect(two.warnings[0]).toBe("The company borrows to buy out Ben's shares (32% of the company).");
  });

  it("falls back to the largest heir when none works in the business", () => {
    const r = simulate(withHeirs([heir("Ana", 0.3), heir("Ben", 0.7)]), transfer(1));
    expect(departingHeir(r.heirs)?.name).toBe("Ben");
  });

  it("deepens the dispute discount with each heir who stays", () => {
    const solo = runShock(withHeirs([heir("Ana", 1, true)]), transfer(0.5), governance, "successorExit");
    const family = runShock(
      withHeirs([heir("Ana", 1, true), heir("Ben", 0.5), heir("Cy", 0.5)]),
      transfer(1),
      governance,
      "successorExit",
    );
    expect(family.changes.multipleCut).toBeCloseTo(solo.changes.multipleCut * 1.5, 12);
    expect(family.warnings).toContain("2 other heirs stay on as owners, so a contested price can spread into a wider family dispute.");
  });
});

describe("persistence", () => {
  it("round-trips named heirs", () => {
    const heirs = [heir("Ana", 0.7, true), heir("Ben", 0.3)];
    const snapshot = { ...defaultSnapshot(), baseline: withHeirs(heirs) };
    expect(fromRow(toRow(snapshot)).baseline.heirs).toEqual(heirs);
  });

  it("falls back to the default heir when the saved list is malformed", () => {
    const row = { baseline: { ebitda: 20, heirs: [{ id: "a", name: 7, share: "x" }] }, scenario: {}, governance: {}, fork: {}, priorities: {} };
    const parsed = fromRow(row);
    expect(parsed.baseline.ebitda).toBe(20);
    expect(parsed.baseline.heirs).toBeUndefined();
  });
});

describe("stake-weighted heir alignment", () => {
  // A dividend recap with a 60% transfer: cash goes out, the next generation gains ground.
  const recap: Scenario = { ...transfer(0.6), leverage: 4 };
  const support = (score: ReturnType<typeof scoreScenario>, id: string) => score.stakeholders.find((s) => s.id === id)!.support;

  it("gives the single default heir the Next-gen heir's support, with no dispersion", () => {
    const score = scoreScenario(base, recap);
    expect(score.heirs).toHaveLength(1);
    expect(score.heirs[0].support).toBe(support(score, "nextGen"));
    expect(score.heirDispersion).toBe(0);
  });

  it("scores heirs who all work in the business alike, so splitting them changes nothing", () => {
    const split = scoreScenario(withHeirs([heir("Ana", 0.5, true), heir("Ben", 0.5, true)]), recap);
    const single = scoreScenario(base, recap);
    expect(split.heirs.map((h) => h.support)).toEqual([support(single, "nextGen"), support(single, "nextGen")]);
    expect(split.alignment).toBeCloseTo(single.alignment, 12);
    expect(split.heirDispersion).toBe(0);
  });

  it("judges an heir outside the business on cash rather than succession, and weights the block by stake", () => {
    const score = scoreScenario(withHeirs([heir("Ana", 0.75, true), heir("Ben", 0.25)]), recap);
    const [ana, ben] = score.heirs;
    expect(ana.support).not.toBeCloseTo(ben.support, 3);
    expect(support(score, "nextGen")).toBeCloseTo(0.75 * ana.support + 0.25 * ben.support, 12);
    expect(score.heirDispersion).toBeCloseTo(Math.abs(ana.support - ben.support), 12);
  });

  it("counts every heir as a seat in the disagreement penalty", () => {
    const score = scoreScenario(withHeirs([heir("Ana", 0.75, true), heir("Ben", 0.25)]), recap);
    const others = score.stakeholders.filter((s) => s.id !== "nextGen").map((s) => s.support);
    const seats = [...others, ...score.heirs.map((h) => h.support)];
    const mean = score.stakeholders.reduce((sum, s) => sum + s.support, 0) / 4;
    expect(score.alignment).toBeCloseTo(Math.max(0, mean - 0.5 * (Math.max(...seats) - Math.min(...seats))), 12);
  });

  it("leaves out heirs with no stake", () => {
    const score = scoreScenario(withHeirs([heir("Ana", 1, true), heir("Ben", 0)]), recap);
    expect(score.heirs.map((h) => h.name)).toEqual(["Ana"]);
  });

  it("explains the weighting with the engine's own figures", () => {
    const baseline = withHeirs([heir("Ana", 0.75, true), heir("Ben", 0.25)]);
    const score = scoreScenario(baseline, recap);
    const text = explainAlignment(baseline, recap).steps.map((s) => s.text).join(" | ");
    expect(text).toContain("Next-gen heir support is each heir's, weighted by stake: Ana 75% ×");
    expect(text).toContain("Ben doesn't work in the business");
    expect(text).toContain(`= ${score.alignment.toFixed(1)}.`);
    // The default single heir reads exactly as before heirs existed.
    expect(explainAlignment(base, recap).steps.map((s) => s.text).join(" | ")).not.toContain("weighted by stake");
    expect(DEFAULT_PRIORITIES.nextGen.succession).toBeGreaterThan(0);
  });
});
