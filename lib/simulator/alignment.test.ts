import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES, contributions, scoreScenario, type Priorities } from "./alignment";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import { STRATEGIES, strategyScenario } from "./strategies";
import type { Baseline, BaselineFigures, Scenario } from "./types";

const base = DEMO_BASELINE;
const neutral = neutralScenario(base);
const score = (scenario: Partial<Scenario> = {}, baseline: Baseline = base) =>
  scoreScenario(baseline, { ...neutralScenario(baseline), ...scenario });
const supports = (s: ReturnType<typeof score>) =>
  Object.fromEntries(s.stakeholders.map((h) => [h.id, h.support]));
const strategy = (id: string) => {
  const found = STRATEGIES.find((s) => s.id === id);
  if (!found) throw new Error(`unknown strategy ${id}`);
  return scoreScenario(base, strategyScenario(base, found));
};

// Expected values are hand-calculated from the rules in alignment.ts.
describe("scoreScenario: demo company", () => {
  it("scores today: engaged founder and lender, disengaged heir", () => {
    const s = score();
    expect(supports(s)).toEqual({ founder: 80, nextGen: 35, board: 68, lender: 90 });
    expect(s.economics).toBeCloseTo(70);
    expect(s.alignment).toBeCloseTo(40.75); // mean 68.25 − 0.5 × spread 55
  });

  it("scores a dividend recap: cash for the founder, strain for the lender", () => {
    const s = strategy("dividend-recap");
    const h = supports(s);
    expect(s.subScores.resilience).toBeCloseTo(63.333, 2); // coverage 4.17x binds
    expect(s.subScores.liquidity).toBeCloseTo(83.333, 2);
    expect(h.founder).toBeCloseTo(79.5);
    expect(h.nextGen).toBeCloseTo(27.667, 2);
    expect(h.board).toBeCloseTo(53.333, 2);
    expect(h.lender).toBeCloseTo(54);
    expect(s.economics).toBeCloseTo(55.333, 2);
    expect(s.alignment).toBeCloseTo(27.708, 2);
  });

  it("scores a gradual transition as the most aligned preset", () => {
    const s = strategy("gradual-transition");
    expect(supports(s)).toEqual({ founder: 62, nextGen: 55, board: 68, lender: 90 });
    expect(s.alignment).toBeCloseTo(51.25);
    expect(s.economics).toBeCloseTo(70);
  });

  it("scores a full handoff as flipping who is disengaged", () => {
    const s = strategy("full-handoff");
    expect(supports(s)).toEqual({ founder: 35, nextGen: 85, board: 68, lender: 90 });
    expect(s.alignment).toBeCloseTo(42);
  });

  it("scores an outside CEO: board approves, heir's path is blocked", () => {
    const s = strategy("outside-ceo");
    const h = supports(s);
    expect(s.subScores.value).toBeCloseTo(45);
    expect(h.founder).toBeCloseTo(69.75);
    expect(h.nextGen).toBeCloseTo(33.5);
    expect(h.board).toBeCloseTo(78);
    expect(h.lender).toBeCloseTo(90);
    expect(s.economics).toBeCloseTo(67);
    expect(s.alignment).toBeCloseTo(39.5625);
  });

  it("rewards a balanced 50% transfer over either extreme", () => {
    const half = score({ equityTransfer: 0.5 }).alignment;
    expect(half).toBeCloseTo(52.625);
    expect(half).toBeGreaterThan(score({ equityTransfer: 0 }).alignment);
    expect(half).toBeGreaterThan(score({ equityTransfer: 1 }).alignment);
  });

  it("drops resilience to zero when equity goes underwater", () => {
    const s = score({ leverage: 6, multipleShock: -0.4 });
    expect(s.subScores.resilience).toBe(0);
  });
});

describe("scoreScenario: governance debt cascade", () => {
  it("drags today's resilience, economics and consensus down at the demo score of 78", () => {
    const s = scoreScenario(base, neutral, 78);
    const h = supports(s);
    expect(s.subScores.resilience).toBeCloseTo(61); // 100 × (1 − 0.5 × 0.78)
    expect(h.founder).toBeCloseTo(74.15);
    expect(h.nextGen).toBeCloseTo(27.2);
    expect(h.board).toBeCloseTo(52.4);
    expect(h.lender).toBeCloseTo(58.8);
    expect(s.economics).toBeCloseTo(54.4);
    expect(s.alignment).toBeCloseTo(29.6625);
  });

  it("leaves scores unchanged at a governance score of 0", () => {
    expect(scoreScenario(base, neutral, 0)).toEqual(scoreScenario(base, neutral));
  });

  it("never raises economics as governance debt grows", () => {
    let previous = Infinity;
    for (let g = 0; g <= 100; g += 10) {
      const { economics } = scoreScenario(base, neutral, g);
      expect(economics).toBeLessThanOrEqual(previous + 1e-9);
      previous = economics;
    }
  });
});

describe("scoreScenario: stakeholder priorities", () => {
  const withFounder = (founder: Partial<Priorities["founder"]>): Priorities => ({
    ...DEFAULT_PRIORITIES,
    founder: { ...DEFAULT_PRIORITIES.founder, control: 0, value: 0, liquidity: 0, resilience: 0, ...founder },
  });

  it("reproduces the founding weights by default", () => {
    expect(scoreScenario(base, neutral, 0, DEFAULT_PRIORITIES)).toEqual(scoreScenario(base, neutral));
  });

  it("scores a single-priority stakeholder at exactly that sub-score", () => {
    const s = scoreScenario(base, { ...neutral, multipleShock: -0.2 }, 0, withFounder({ value: 7 }));
    expect(s.subScores.value).toBeCloseTo(30);
    expect(supports(s).founder).toBeCloseTo(30);
  });

  it("only cares about relative importance, not absolute slider values", () => {
    const a = scoreScenario(base, neutral, 0, withFounder({ control: 2, value: 1 }));
    const b = scoreScenario(base, neutral, 0, withFounder({ control: 20, value: 10 }));
    expect(supports(a).founder).toBeCloseTo(supports(b).founder);
  });

  it("treats a stakeholder who cares about nothing as neutral (50)", () => {
    const s = scoreScenario(base, neutral, 0, withFounder({}));
    expect(supports(s).founder).toBe(50);
    expect(contributions("founder", s.subScores, withFounder({}))).toEqual([]);
  });

  it("explains support as weighted pulls away from neutral", () => {
    const s = score();
    const parts = contributions("founder", s.subScores);
    // Founder today: control 100 (+22.5), value 50 (0), liquidity 50 (0), resilience 100 (+7.5).
    expect(parts.map((p) => [p.key, p.weight, p.impact])).toEqual([
      ["control", 0.45, 22.5],
      ["value", 0.25, 0],
      ["liquidity", 0.15, 0],
      ["resilience", 0.15, 7.5],
    ]);
    expect(50 + parts.reduce((sum, p) => sum + p.impact, 0)).toBeCloseTo(supports(s).founder);
  });
});

describe("scoreScenario: behaviour", () => {
  it("never raises lender support as leverage climbs", () => {
    let previous = Infinity;
    for (let leverage = 0; leverage <= 6; leverage += 0.25) {
      const lender = supports(score({ leverage })).lender;
      expect(lender).toBeLessThanOrEqual(previous + 1e-9);
      previous = lender;
    }
  });

  it("never lowers heir support as more equity transfers", () => {
    let previous = -Infinity;
    for (let transfer = 0; transfer <= 1; transfer += 0.05) {
      const heir = supports(score({ equityTransfer: transfer })).nextGen;
      expect(heir).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = heir;
    }
  });

  it("keeps every score within 0–100 for hostile inputs", () => {
    const extremes = [Number.NaN, -Infinity, -1e12, -1, 0, 0.5, 1e12, Infinity];
    const inRange = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
    for (const value of extremes) {
      for (const key of Object.keys(base) as (keyof BaselineFigures)[]) {
        for (const outsideCeo of [false, true]) {
          const s = scoreScenario({ ...base, [key]: value }, { ...neutralScenario(base), outsideCeo, leverage: value, equityTransfer: value, multipleShock: value });
          expect(inRange(s.economics)).toBe(true);
          expect(inRange(s.alignment)).toBe(true);
          for (const h of s.stakeholders) expect(inRange(h.support)).toBe(true);
          for (const sub of Object.values(s.subScores)) expect(inRange(sub)).toBe(true);
        }
      }
    }
  });
});
