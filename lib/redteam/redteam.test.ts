import { describe, expect, it } from "vitest";
import { BEST_PRACTICE_GOVERNANCE, DEMO_GOVERNANCE } from "../governance/model";
import { DEMO_BASELINE, neutralScenario } from "../simulator/defaults";
import { simulate } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import { breakingPoints } from "./breaking";
import { SHOCKS, runShock } from "./shocks";
import type { ShockId } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const shock = (
  id: ShockId,
  scenario: Partial<Scenario> = {},
  governance = DEMO_GOVERNANCE,
  baseline: Baseline = base,
) => runShock(baseline, { ...neutral, ...scenario }, governance, id);

// Expected values are hand-calculated from the calibration in shocks.ts.
describe("founder incapacitation", () => {
  const r = shock("incapacitation");
  const cut = 0.05 + 0.15 * (29 / 35); // authority gap 29/35

  it("scales the hit with undocumented authority", () => {
    expect(r.changes.ebitdaCut).toBeCloseTo(cut);
    expect(r.changes.multipleCut).toBeCloseTo(cut);
    expect(r.after.ebitda).toBeCloseTo(9.908571, 5);
    expect(r.after.enterpriseValue).toBeCloseTo(65.4532, 3);
    expect(r.valueDestroyed).toBeCloseTo(30.5468, 3);
    expect(r.verdict).toBe("survives");
  });

  it("warns of a control vacuum when the founder controls without an incapacitation plan", () => {
    expect(r.warnings.some((w) => w.startsWith("Control vacuum"))).toBe(true);
    const planned = shock("incapacitation", {}, { ...DEMO_GOVERNANCE, incapacitationPlan: "yes" });
    expect(planned.warnings.some((w) => w.startsWith("Control vacuum"))).toBe(false);
  });

  it("shrinks to a 5% hit with best-practice authority, saving $21.2M", () => {
    expect(r.dividend?.categories).toEqual(["authority"]);
    expect(r.dividend?.changes.ebitdaCut).toBeCloseTo(0.05);
    expect(r.dividend?.valueSaved).toBeCloseTo(30.5468 - 9.36, 3);
  });

  it("halves the operating hit with an outside CEO", () => {
    const withCeo = shock("incapacitation", { outsideCeo: true });
    expect(withCeo.changes.ebitdaCut).toBeCloseTo(cut / 2);
    expect(withCeo.changes.multipleCut).toBeCloseTo(cut);
  });
});

describe("successor exit", () => {
  it("has limited exposure when the heir holds no shares", () => {
    const r = shock("successorExit");
    expect(r.changes).toEqual({ ebitdaCut: 0.03, multipleCut: 0, extraDebt: 0, rateIncrease: 0 });
    expect(r.warnings[0]).toMatch(/^No heir stake/);
  });

  it("borrows to buy out the heir at the agreement's discounted price", () => {
    const r = shock("successorExit", { equityTransfer: 0.5 });
    // Heir stake 0.4 × $90M = $36M; partial buy-sell → 12.5% discount.
    expect(r.changes.extraDebt).toBeCloseTo(31.5);
    expect(r.changes.multipleCut).toBeCloseTo(0.1 * (2.5 / 3));
    expect(r.after.debt).toBeCloseTo(37.5);
    expect(r.after.interestCoverage).toBeCloseTo(11.64 / 3);
    expect(r.valueDestroyed).toBeCloseTo(10.64, 2);
  });

  it("pays full value with no buy-sell agreement", () => {
    const r = shock("successorExit", { equityTransfer: 0.5 }, { ...DEMO_GOVERNANCE, buySellAgreement: "no" });
    expect(r.changes.extraDebt).toBeCloseTo(36);
    expect(r.warnings.some((w) => w.startsWith("No buy-sell agreement"))).toBe(true);
  });

  it("never prices a buyout below zero, even underwater", () => {
    const r = shock("successorExit", { equityTransfer: 1, leverage: 6, multipleShock: -0.4 });
    expect(r.changes.extraDebt).toBe(0);
  });
});

describe("economic downturn", () => {
  it("cuts earnings harder with an informal board and raises rates", () => {
    const r = shock("downturn");
    expect(r.changes.ebitdaCut).toBeCloseTo(0.25 + 0.1 * (25 / 35));
    expect(r.changes.rateIncrease).toBeCloseTo(0.02);
    expect(r.after.enterpriseValue).toBeCloseTo(8.142857 * 6, 3);
    expect(r.after.interestCoverage).toBeCloseTo(8.142857 / 0.6, 3);
  });

  it("breaks a heavily levered company", () => {
    expect(shock("downturn", { leverage: 5 }).verdict).toBe("breaks");
  });
});

describe("all shocks", () => {
  it("makes the perfect storm at least as damaging as any single shock", () => {
    for (const scenario of [{}, { equityTransfer: 0.5, leverage: 3 }, { outsideCeo: true }]) {
      const storm = shock("perfectStorm", scenario).valueDestroyed;
      for (const id of ["incapacitation", "successorExit", "downturn"] as const) {
        expect(storm).toBeGreaterThanOrEqual(shock(id, scenario).valueDestroyed - 1e-9);
      }
    }
  });

  it("shrinks every governance-sensitive hit, and offers no dividend once governance is best practice", () => {
    for (const { id } of SHOCKS) {
      const weak = shock(id, { equityTransfer: 0.5 });
      const strong = shock(id, { equityTransfer: 0.5 }, BEST_PRACTICE_GOVERNANCE);
      expect(strong.valueDestroyed).toBeLessThanOrEqual(weak.valueDestroyed + 1e-9);
      expect(strong.dividend).toBeNull();
    }
  });

  it("stays finite for hostile inputs", () => {
    for (const x of [Number.NaN, -Infinity, -1e9, 0, 1e9, Infinity]) {
      for (const { id } of SHOCKS) {
        const r = runShock(
          { ...base, ebitda: x, multiple: x, interestRate: x, existingDebt: x },
          { ...neutral, leverage: x, equityTransfer: x },
          { ...DEMO_GOVERNANCE, boardSeatsFilled: x },
          id,
        );
        const numbers = [r.valueDestroyed, ...Object.values(r.changes), ...Object.values(r.after)];
        expect(numbers.every((n) => n === null || Number.isFinite(n))).toBe(true);
      }
    }
  });
});

describe("breakingPoints", () => {
  const points = (scenario: Partial<Scenario> = {}) =>
    breakingPoints(simulate(base, { ...neutral, ...scenario }), base.interestRate);
  const byId = (s: Partial<Scenario> = {}) => Object.fromEntries(points(s).map((p) => [p.id, p.threshold]));

  it("finds today's limits far away, ranked closest first", () => {
    expect(byId()).toEqual({
      leverage: expect.closeTo(0.9), // 1 − 6 / 60
      coverage: expect.closeTo(0.92), // 1 − 2 × 6 × 8% / 12
      equityByEbitda: expect.closeTo(0.9375), // 1 − 6 / 96
      equityByMultiple: expect.closeTo(0.9375),
    });
    expect(points().map((p) => p.id)).toEqual(["leverage", "coverage", "equityByEbitda", "equityByMultiple"]);
    expect(points().every((p) => p.severity === "positive")).toBe(true);
  });

  it("brings limits closer after a dividend recap", () => {
    const recap = byId({ leverage: 3 });
    expect(recap.leverage).toBeCloseTo(0.4); // 1 − 36 / 60
    expect(recap.coverage).toBeCloseTo(0.52); // 1 − 2 × 36 × 8% / 12
    expect(recap.equityByEbitda).toBeCloseTo(0.625);
  });

  it("reports limits that are already broken as 0, and flags them critical", () => {
    const stressed = points({ leverage: 6, multipleShock: -0.4 });
    const map = Object.fromEntries(stressed.map((p) => [p.id, p]));
    expect(map.leverage.threshold).toBe(0);
    expect(map.equityByEbitda.threshold).toBe(0);
    expect(map.coverage.threshold).toBeCloseTo(0.04);
    expect(stressed.every((p) => p.severity === "critical")).toBe(true);
  });

  it("returns null for limits a debt-free company cannot break", () => {
    expect(points({ leverage: 0 }).every((p) => p.threshold === null && p.severity === "positive")).toBe(true);
  });
});
