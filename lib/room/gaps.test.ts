import { describe, expect, it } from "vitest";
import { detectGaps } from "./gaps";
import { DEMO_RESPONSES } from "./topics";
import type { RoomResponses } from "./types";

// Expected values are hand-calculated from DEMO_RESPONSES.
describe("detectGaps: demo room", () => {
  const gaps = detectGaps(DEMO_RESPONSES);

  it("marks all four stakeholders complete", () => {
    expect(gaps.completion).toEqual({ founder: true, nextGen: true, board: true, lender: true });
  });

  it("finds three deep disagreements and three moderate ones", () => {
    expect(gaps.disagreements.map((d) => [d.topicId, d.spread, d.severity])).toEqual([
      ["nextGenReady", 3, "critical"], // 5, 2, 2, 3
      ["founderControl", 3, "critical"], // 5, 2, 2, 3
      ["outsideCeo", 3, "critical"], // 1, 4, 4, 4
      ["takeCash", 2, "caution"], // 2, 4, 2, 2
      ["governanceAdequate", 2, "caution"], // 4, 2, 2, 2
      ["sellWithin10", 2, "caution"], // 1, 3, 2, 3
    ]);
  });

  it("shows the founder misreading the heir across the board", () => {
    const founderReads = gaps.misperceptions.filter((m) => m.observer === "founder");
    expect(founderReads.map((m) => [m.topicId, m.gap, m.severity])).toEqual([
      ["nextGenReady", 3, "critical"], // predicted 5, heir said 2
      ["outsideCeo", 3, "critical"], // predicted 1, heir said 4
      ["founderControl", 2, "caution"],
      ["takeCash", 2, "caution"],
      ["governanceAdequate", 2, "caution"],
      ["sellWithin10", 2, "caution"],
    ]);
    expect(founderReads.every((m) => m.target === "nextGen")).toBe(true);
  });

  it("finds the heir only slightly misreads the founder, and board and lender read the founder well", () => {
    const others = gaps.misperceptions.filter((m) => m.observer !== "founder");
    expect(others.map((m) => [m.observer, m.target, m.topicId, m.gap])).toEqual([
      ["nextGen", "founder", "nextGenReady", 2],
    ]);
  });

  it("sorts critical gaps before cautions", () => {
    const severities = gaps.misperceptions.map((m) => m.severity);
    expect(severities.indexOf("caution")).toBeGreaterThan(severities.lastIndexOf("critical"));
  });

  it("never exposes anyone's actual answers", () => {
    const allowed = new Set(["topicId", "topic", "spread", "gap", "severity", "observer", "target"]);
    for (const item of [...gaps.disagreements, ...gaps.misperceptions]) {
      for (const key of Object.keys(item)) expect(allowed.has(key)).toBe(true);
    }
    expect(JSON.stringify(gaps)).not.toMatch(/positions|predictions/);
  });
});

describe("detectGaps: partial rooms", () => {
  it("ignores unsubmitted and incomplete responses", () => {
    const responses: RoomResponses = {
      founder: DEMO_RESPONSES.founder,
      nextGen: { ...DEMO_RESPONSES.nextGen!, submitted: false },
      board: { ...DEMO_RESPONSES.board!, positions: { nextGenReady: 1 } },
    };
    const gaps = detectGaps(responses);
    expect(gaps.completion).toEqual({ founder: true, nextGen: false, board: false, lender: false });
    expect(gaps.disagreements).toEqual([]);
    expect(gaps.misperceptions).toEqual([]);
  });

  it("needs the prediction target's answers before reporting a misperception", () => {
    const gaps = detectGaps({ founder: DEMO_RESPONSES.founder, board: DEMO_RESPONSES.board });
    expect(gaps.misperceptions.every((m) => m.observer === "board" && m.target === "founder")).toBe(true);
    expect(gaps.disagreements.length).toBeGreaterThan(0);
  });

  it("does not report gaps of a single point", () => {
    const same = DEMO_RESPONSES.founder!;
    const gaps = detectGaps({
      founder: same,
      nextGen: { positions: same.predictions, predictions: same.positions, submitted: true },
    });
    // The heir answers exactly as the founder predicted: no misperceptions either way beyond 1 point.
    expect(gaps.misperceptions.filter((m) => m.observer === "founder")).toEqual([]);
    expect(gaps.disagreements.every((d) => d.spread >= 2)).toBe(true);
  });

  it("returns an empty room for no responses", () => {
    expect(detectGaps({})).toEqual({
      completion: { founder: false, nextGen: false, board: false, lender: false },
      disagreements: [],
      misperceptions: [],
    });
  });
});
