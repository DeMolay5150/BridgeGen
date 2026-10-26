import { describe, expect, it } from "vitest";
import { roomBrief } from "../narrative/room";
import type { Heir } from "../simulator/types";
import { detectGaps, expectedSeats } from "./gaps";
import { inviteBodySchema } from "./schema";
import { heirSeat, orderSeats, seatName, seatPhrase, seatSchema, stakeholderOf, type SeatId } from "./seats";
import { rowsToResponses } from "./server-logic";
import { DEMO_RESPONSES, TOPIC_IDS } from "./topics";
import type { Rating, RoomResponse, RoomResponses } from "./types";

const heirs: Heir[] = [
  { id: "heir-ana", name: "Ana", share: 0.6, active: true },
  { id: "heir-ben", name: "Ben", share: 0.4, active: false },
];
const ANA = "nextGen:heir-ana" as const;
const BEN = "nextGen:heir-ben" as const;

/** Same rating on every topic, for positions and predictions. */
const flat = (position: Rating, prediction: Rating = position): RoomResponse => ({
  positions: Object.fromEntries(TOPIC_IDS.map((id) => [id, position])),
  predictions: Object.fromEntries(TOPIC_IDS.map((id) => [id, prediction])),
  submitted: true,
});

describe("seats", () => {
  it("accepts the four stakeholders and well-formed heir seats only", () => {
    for (const ok of ["founder", "nextGen", "board", "lender", ANA, "nextGen:a_B-9"]) expect(seatSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["advisor", "nextGen:", "nextGen:a b", "nextgen:x", `nextGen:${"x".repeat(41)}`, 7, null]) {
      expect(seatSchema.safeParse(bad).success).toBe(false);
    }
    expect(inviteBodySchema.safeParse({ stakeholder: ANA }).success).toBe(true);
  });

  it("only makes seats from ids that fit the seat key", () => {
    expect(heirSeat("heir-ana")).toBe(ANA);
    expect(heirSeat("has space")).toBeNull();
  });

  it("orders the room founder, shared next-gen, heirs, board, lender", () => {
    expect(orderSeats(["lender", BEN, "board", ANA, "founder", "nextGen"])).toEqual(["founder", "nextGen", ANA, BEN, "board", "lender"]);
    expect(stakeholderOf(BEN)).toBe("nextGen");
  });

  it("names heirs from the baseline, never guessing", () => {
    expect(seatName(ANA, heirs)).toBe("Ana");
    expect(seatName("nextGen:heir-gone", heirs)).toBe("An heir");
    expect(seatPhrase("board", heirs)).toBe("the Board");
    expect(seatPhrase("board", heirs, true)).toBe("the board");
    expect(seatPhrase(BEN, heirs, true)).toBe("Ben");
    expect(seatPhrase("nextGen:heir-gone", heirs, true)).toBe("an heir");
  });

  it("keeps stored heir answers and still drops tampered rows", () => {
    const rows = [
      { stakeholder: ANA, ...flat(4) },
      { stakeholder: "nextGen:bad seat", ...flat(4) },
    ];
    expect(Object.keys(rowsToResponses(rows))).toEqual([ANA]);
  });
});

describe("detectGaps with heir seats", () => {
  it("is unchanged for rooms without heir seats", () => {
    expect(Object.keys(detectGaps(DEMO_RESPONSES).completion)).toEqual(["founder", "nextGen", "board", "lender"]);
    expect(expectedSeats({})).toEqual(["founder", "nextGen", "board", "lender"]);
  });

  it("expects each invited heir instead of the shared seat", () => {
    const gaps = detectGaps({ founder: flat(3) }, [ANA, BEN, "not-a-seat"]);
    expect(gaps.completion).toEqual({ founder: true, [ANA]: false, [BEN]: false, board: false, lender: false });
  });

  it("keeps the shared seat when it already has answers", () => {
    expect(expectedSeats({ nextGen: flat(3), [ANA]: flat(3) })).toEqual(["founder", "nextGen", ANA, "board", "lender"]);
  });

  it("finds a split between heirs and checks the founder's read of each heir separately", () => {
    // The founder expects the next generation to answer 4; Ana does, Ben answers 1.
    const responses: RoomResponses = { founder: flat(4, 4), [ANA]: flat(4, 4), [BEN]: flat(1, 4) };
    const gaps = detectGaps(responses);
    expect(gaps.disagreements.every((d) => d.spread === 3 && d.severity === "critical")).toBe(true);
    const pairs = new Set(gaps.misperceptions.map((m) => `${m.observer}>${m.target}`));
    expect(pairs).toEqual(new Set([`founder>${BEN}`]));
    // Heirs predict the founder: both expected 4 and the founder said 4, so no misread that way.
    expect(gaps.misperceptions).toHaveLength(TOPIC_IDS.length);
  });

  it("never carries anyone's answers", () => {
    const gaps = detectGaps({ founder: flat(5, 1), [ANA]: flat(1, 1) });
    const json = JSON.stringify(gaps);
    expect(json).not.toMatch(/positions|predictions/);
  });
});

describe("room brief with heir seats", () => {
  it("names heirs in findings and actions, from detectGaps output only", () => {
    const gaps = detectGaps({ founder: flat(4, 4), [ANA]: flat(4, 4), [BEN]: flat(1, 4) }, [ANA, BEN]);
    const brief = roomBrief(gaps, heirs);
    expect(brief.headline).toContain("across 3 stakeholders");
    expect(brief.findings).toContain(`The founder misreads Ben on “${gaps.misperceptions[0].topic}”.`);
    expect(brief.actions[0]).toBe("Facilitate a structured conversation between the founder and Ben before committing capital.");
    expect(brief.actions).toContain("Collect the views of the board and the lender before the decision is taken.");
  });

  it("falls back to 'an heir' when the name isn't known", () => {
    const gaps = detectGaps({ founder: flat(4, 4), [BEN]: flat(1, 4) });
    expect(roomBrief(gaps).findings[1]).toMatch(/^The founder misreads an heir on/);
  });

  it("counts every expected seat while collecting", () => {
    const seats: SeatId[] = [ANA, BEN];
    expect(roomBrief(detectGaps({ founder: flat(3) }, seats), heirs).headline).toContain("1 of 5 stakeholders");
  });
});
