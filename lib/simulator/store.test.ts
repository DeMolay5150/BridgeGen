import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PRIORITIES } from "./alignment";
import { useSimulatorStore } from "./store";

const store = () => useSimulatorStore.getState();

beforeEach(() => store().reset());

describe("Decision Room store", () => {
  it("un-submits a response when its answers are edited", () => {
    store().loadDemoRoom();
    expect(store().room.founder?.submitted).toBe(true);
    store().setResponse("founder", { positions: { nextGenReady: 1 } });
    const founder = store().room.founder!;
    expect(founder.submitted).toBe(false);
    expect(founder.positions.nextGenReady).toBe(1);
    // Other answers are kept.
    expect(founder.positions.founderControl).toBe(5);
  });

  it("submits explicitly and keeps answers when only the flag changes", () => {
    store().setResponse("board", { positions: { outsideCeo: 4 } });
    store().setResponse("board", { submitted: true });
    expect(store().room.board).toEqual({ positions: { outsideCeo: 4 }, predictions: {}, submitted: true });
  });

  it("keeps each stakeholder's responses separate", () => {
    store().setResponse("nextGen", { positions: { takeCash: 5 } });
    expect(store().room.founder).toBeUndefined();
    expect(store().room.nextGen?.positions).toEqual({ takeCash: 5 });
  });

  it("tunes and restores one stakeholder's priorities without touching others", () => {
    store().setPriorities("lender", { resilience: 2 });
    expect(store().priorities.lender.resilience).toBe(2);
    expect(store().priorities.founder).toEqual(DEFAULT_PRIORITIES.founder);
    store().resetPriorities("lender");
    expect(store().priorities.lender).toEqual(DEFAULT_PRIORITIES.lender);
  });

  it("clears the room and resets everything", () => {
    store().loadDemoRoom();
    store().clearRoom();
    expect(store().room).toEqual({});
    store().setPriorities("board", { value: 0 });
    store().reset();
    expect(store().priorities).toEqual(DEFAULT_PRIORITIES);
  });
});
