import { describe, expect, it } from "vitest";
import {
  BEST_PRACTICE_GOVERNANCE,
  DEMO_GOVERNANCE,
  governanceDebtValue,
  scoreGovernance,
} from "./model";
import type { GovernanceAnswers } from "./types";

const WORST: GovernanceAnswers = {
  delegationOfAuthority: "no",
  successionPlan: "no",
  incapacitationPlan: "no",
  boardSeatsFilled: 0,
  boardSeatsRecommended: 5,
  independentDirectors: 0,
  meetingCadence: "adhoc",
  buySellAgreement: "no",
  votingRules: "no",
  disputeResolution: "no",
};

const score = (patch: Partial<GovernanceAnswers> = {}) =>
  scoreGovernance({ ...BEST_PRACTICE_GOVERNANCE, ...patch });
const points = (s: ReturnType<typeof scoreGovernance>, id: string) =>
  s.items.find((i) => i.id === id)?.points;

describe("scoreGovernance", () => {
  it("item weights sum to 100", () => {
    expect(scoreGovernance(WORST).items.reduce((sum, i) => sum + i.maxPoints, 0)).toBe(100);
  });

  it("scores the demo company at 78", () => {
    const s = scoreGovernance(DEMO_GOVERNANCE);
    // 12 + 6 + 11 | 9 + 12 + 4 | 6 + 10 + 8
    expect(s.score).toBeCloseTo(78);
    expect(s.categories.map((c) => [c.id, c.points])).toEqual([
      ["authority", 29],
      ["board", 25],
      ["voting", 24],
    ]);
  });

  it("scores best practice at 0 and no governance at 100", () => {
    expect(scoreGovernance(BEST_PRACTICE_GOVERNANCE).score).toBe(0);
    expect(scoreGovernance(WORST).score).toBe(100);
  });

  it("charges half points for partial practices and annual meetings", () => {
    expect(points(score({ votingRules: "partial" }), "votingRules")).toBe(5);
    expect(points(score({ meetingCadence: "annual" }), "meetingCadence")).toBe(4);
  });

  it("scores board seats against the recommended size", () => {
    expect(points(score({ boardSeatsFilled: 2, boardSeatsRecommended: 5 }), "boardSeats")).toBeCloseTo(9);
    expect(points(score({ boardSeatsFilled: 7, boardSeatsRecommended: 5 }), "boardSeats")).toBe(0);
    expect(points(score({ boardSeatsFilled: 0, boardSeatsRecommended: 0 }), "boardSeats")).toBe(0);
  });

  it("caps independent directors at the seats actually filled", () => {
    expect(points(score({ boardSeatsFilled: 1, independentDirectors: 3 }), "independentDirectors")).toBe(6);
    expect(points(score({ independentDirectors: 1 }), "independentDirectors")).toBe(6);
    expect(points(score({ independentDirectors: 9 }), "independentDirectors")).toBe(0);
  });

  it("stays within 0–100 for hostile seat inputs", () => {
    const hostile = [Number.NaN, -Infinity, -3, 2.7, 99, Infinity];
    for (const a of hostile) {
      for (const b of hostile) {
        const s = scoreGovernance({ ...WORST, boardSeatsFilled: a, boardSeatsRecommended: b, independentDirectors: a });
        expect(Number.isFinite(s.score)).toBe(true);
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("governanceDebtValue", () => {
  it("prices the demo company's debt as a 30%-max valuation discount", () => {
    expect(governanceDebtValue(96, 78)).toBeCloseTo(22.464);
    expect(governanceDebtValue(96, 100)).toBeCloseTo(28.8);
  });

  it("never returns a negative or non-finite value", () => {
    expect(governanceDebtValue(-50, 78)).toBe(0);
    expect(governanceDebtValue(Number.NaN, 78)).toBe(0);
    expect(governanceDebtValue(96, -10)).toBe(0);
    expect(governanceDebtValue(96, 500)).toBeCloseTo(28.8);
  });
});
