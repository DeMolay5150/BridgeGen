import { describe, expect, it } from "vitest";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import { simulate } from "./engine";
import { formatMoney, formatMultiple, formatSignedPercent } from "./format";
import type { Baseline, Scenario, SimulationResult } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const run = (scenario: Partial<Scenario> = {}, baseline: Partial<Baseline> = {}) =>
  simulate({ ...base, ...baseline }, { ...neutral, ...scenario });
const signalIds = (r: SimulationResult) => r.signals.map((s) => s.id);

describe("simulate: demo company, no change", () => {
  const r = run();

  it("values the company at EBITDA × multiple", () => {
    expect(r.adjustedEbitda).toBe(12);
    expect(r.ebitdaMargin).toBeCloseTo(0.3);
    expect(r.enterpriseValue).toBe(96);
    expect(r.totalDebt).toBeCloseTo(6);
    expect(r.equityValue).toBeCloseTo(90);
    expect(r.netDistribution).toBeCloseTo(0);
  });

  it("splits equity by ownership", () => {
    expect(r.ownership).toEqual({ founder: 0.8, nextGen: 0, others: expect.closeTo(0.2) });
    expect(r.holderEquity.founder).toBeCloseTo(72);
    expect(r.holderEquity.others).toBeCloseTo(18);
  });

  it("computes debt service", () => {
    expect(r.interestExpense).toBeCloseTo(0.48);
    expect(r.interestCoverage).toBeCloseTo(25);
    expect(r.debtToEbitda).toBeCloseTo(0.5);
  });

  it("reports a single positive signal", () => {
    expect(r.signals).toHaveLength(1);
    expect(r.signals[0]).toMatchObject({ id: "within-guardrails", severity: "positive" });
  });
});

describe("simulate: debt leverage", () => {
  it("pays new debt out as a pro-rata dividend recap", () => {
    const r = run({ leverage: 3 });
    expect(r.totalDebt).toBe(36);
    expect(r.netDistribution).toBe(30);
    expect(r.equityValue).toBe(60);
    expect(r.holderDistribution.founder).toBeCloseTo(24);
    expect(r.holderDistribution.others).toBeCloseTo(6);
    expect(r.interestCoverage).toBeCloseTo(12 / 2.88);
    expect(signalIds(r)).toEqual(["within-guardrails"]);
  });

  it("requires a capital contribution to deleverage", () => {
    const r = run({ leverage: 0 });
    expect(r.totalDebt).toBe(0);
    expect(r.netDistribution).toBe(-6);
    expect(r.equityValue).toBe(96);
    expect(r.interestCoverage).toBeNull();
    expect(r.debtToEbitda).toBe(0);
  });

  it("conserves shareholder value: leverage alone moves value between equity and cash", () => {
    for (const leverage of [0, 1, 2.5, 4, 6]) {
      const r = run({ leverage });
      expect(r.equityValue + r.netDistribution).toBeCloseTo(90);
    }
  });

  it("flags elevated leverage at 4x and critical beyond 5x", () => {
    expect(run({ leverage: 4 }).signals.find((s) => s.id === "leverage")?.severity).toBe("caution");
    expect(run({ leverage: 5 }).signals.find((s) => s.id === "leverage")?.severity).toBe("caution");
    expect(run({ leverage: 5.25 }).signals.find((s) => s.id === "leverage")?.severity).toBe("critical");
  });

  it("ignores leverage targets when the company has no EBITDA", () => {
    const r = run({ leverage: 6 }, { ebitda: -2 });
    expect(r.totalDebt).toBe(6);
    expect(r.netDistribution).toBe(0);
  });
});

describe("simulate: equity transfer", () => {
  it("moves the founder's stake to the next generation", () => {
    const r = run({ equityTransfer: 0.25 });
    expect(r.ownership.founder).toBeCloseTo(0.6);
    expect(r.ownership.nextGen).toBeCloseTo(0.2);
    expect(r.holderEquity.nextGen).toBeCloseTo(18);
    expect(signalIds(r)).not.toContain("control-shift");
  });

  it("flags a control shift once heirs out-own the founder", () => {
    const r = run({ equityTransfer: 1 });
    expect(r.ownership.founder).toBe(0);
    expect(r.ownership.nextGen).toBeCloseTo(0.8);
    expect(signalIds(r)).toEqual(["control-shift"]);
  });

  it("keeps ownership summing to 100%", () => {
    for (const equityTransfer of [0, 0.35, 0.5, 1]) {
      for (const founderOwnership of [0, 0.51, 1]) {
        const { ownership } = run({ equityTransfer }, { founderOwnership });
        expect(ownership.founder + ownership.nextGen + ownership.others).toBeCloseTo(1);
      }
    }
  });
});

describe("simulate: valuation sensitivity", () => {
  it("applies the multiple shock to enterprise value", () => {
    const r = run({ multipleShock: -0.25 });
    expect(r.effectiveMultiple).toBe(6);
    expect(r.enterpriseValue).toBe(72);
  });

  it("goes underwater at 6x leverage with a 40% multiple compression", () => {
    const r = run({ leverage: 6, multipleShock: -0.4 });
    expect(r.enterpriseValue).toBeCloseTo(57.6);
    expect(r.totalDebt).toBe(72);
    expect(r.equityValue).toBeCloseTo(-14.4);
    expect(r.holderEquity).toEqual({ founder: 0, nextGen: 0, others: 0 });
    expect(r.signals.map((s) => [s.id, s.severity])).toEqual([
      ["equity-underwater", "critical"],
      ["coverage", "caution"],
      ["leverage", "critical"],
    ]);
  });
});

describe("simulate: outside CEO", () => {
  it("has no effect while switched off", () => {
    expect(run({ ceoCost: 5, ceoUplift: 0.2 }).adjustedEbitda).toBe(12);
  });

  it("adds the performance uplift and deducts the CEO's cost", () => {
    const r = run({ outsideCeo: true, ceoCost: 1.2, ceoUplift: 0.05 });
    expect(r.adjustedEbitda).toBeCloseTo(11.4);
    expect(r.enterpriseValue).toBeCloseTo(91.2);
  });

  it("flags operating losses when the CEO costs more than the business earns", () => {
    const r = run({ outsideCeo: true, ceoCost: 5, ceoUplift: 0 }, { ebitda: 1 });
    expect(r.adjustedEbitda).toBe(-4);
    expect(r.enterpriseValue).toBe(0);
    expect(r.debtToEbitda).toBeNull();
    expect(signalIds(r)).toEqual(["ebitda-negative", "equity-underwater", "coverage"]);
  });
});

describe("simulate: hostile inputs", () => {
  const extremes = [Number.NaN, -Infinity, -1e12, -1, 0, 0.5, 1e12, Infinity];
  const numericBaseline = Object.keys(base) as (keyof Baseline)[];
  const numericScenario = (Object.keys(neutral) as (keyof Scenario)[]).filter(
    (k) => k !== "outsideCeo",
  );

  const expectFinite = (r: SimulationResult) => {
    const numbers = [
      r.adjustedEbitda,
      r.ebitdaMargin,
      r.effectiveMultiple,
      r.enterpriseValue,
      r.totalDebt,
      r.netDistribution,
      r.equityValue,
      r.interestExpense,
      r.interestCoverage,
      r.debtToEbitda,
      ...Object.values(r.ownership),
      ...Object.values(r.holderEquity),
      ...Object.values(r.holderDistribution),
    ];
    for (const n of numbers) {
      if (n !== null) expect(Number.isFinite(n)).toBe(true);
    }
    expect(r.signals.length).toBeGreaterThan(0);
  };

  it("never returns NaN or Infinity for any single extreme baseline value", () => {
    for (const key of numericBaseline) {
      for (const value of extremes) expectFinite(run({}, { [key]: value }));
    }
  });

  it("never returns NaN or Infinity for any single extreme scenario value", () => {
    for (const key of numericScenario) {
      for (const value of extremes) {
        expectFinite(run({ [key]: value, outsideCeo: true }));
      }
    }
  });

  it("survives every input at an extreme at once", () => {
    for (const value of extremes) {
      const baseline = Object.fromEntries(numericBaseline.map((k) => [k, value])) as unknown as Baseline;
      const scenario = {
        ...(Object.fromEntries(numericScenario.map((k) => [k, value])) as unknown as Scenario),
        outsideCeo: true,
      };
      expectFinite(simulate(baseline, scenario));
    }
  });
});

describe("format", () => {
  it("formats money in millions", () => {
    expect(formatMoney(96)).toBe("$96.0M");
    expect(formatMoney(-14.4)).toBe("-$14.4M");
    expect(formatMoney(1250)).toBe("$1.3B");
    expect(formatMoney(0.48)).toBe("$480.0K");
    expect(formatMoney(0)).toBe("$0.0M");
    expect(formatMoney(-0.0001)).toBe("$0.0M");
  });

  it("formats multiples and signed percentages", () => {
    expect(formatMultiple(8)).toBe("8.0x");
    expect(formatMultiple(null)).toBe("n/a");
    expect(formatSignedPercent(-0.2)).toBe("−20%");
    expect(formatSignedPercent(0.1)).toBe("+10%");
    expect(formatSignedPercent(0.0000001)).toBe("0%");
  });
});
