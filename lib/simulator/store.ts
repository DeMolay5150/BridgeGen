import { create } from "zustand";
import { DEMO_GOVERNANCE, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { DEFAULT_ASSUMPTIONS } from "../projection/model";
import type { BranchSpec, ProjectionAssumptions } from "../projection/types";
import { DEMO_RESPONSES } from "../room/topics";
import type { RoomResponse, RoomResponses } from "../room/types";
import {
  DEFAULT_PRIORITIES,
  type PriorityKey,
  type Priorities,
  type StakeholderId,
} from "./alignment";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import type { Baseline, Scenario } from "./types";

export interface ForkState {
  a: BranchSpec;
  b: BranchSpec;
  assumptions: ProjectionAssumptions;
}

const DEFAULT_FORK: ForkState = {
  a: { source: "today", fixGovernance: false },
  b: { source: "current", fixGovernance: false },
  assumptions: DEFAULT_ASSUMPTIONS,
};

const EMPTY_RESPONSE: RoomResponse = { positions: {}, predictions: {}, submitted: false };

interface SimulatorState {
  baseline: Baseline;
  scenario: Scenario;
  governance: GovernanceAnswers;
  fork: ForkState;
  priorities: Priorities;
  /** Decision Room questionnaires. In memory only; never persisted. */
  room: RoomResponses;
  setBaseline: (patch: Partial<Baseline>) => void;
  setScenario: (patch: Partial<Scenario>) => void;
  setGovernance: (patch: Partial<GovernanceAnswers>) => void;
  setFork: (patch: Partial<ForkState>) => void;
  setPriorities: (id: StakeholderId, patch: Partial<Record<PriorityKey, number>>) => void;
  resetPriorities: (id: StakeholderId) => void;
  /** Editing answers un-submits the response so gaps never use a half-edited set. */
  setResponse: (id: StakeholderId, patch: Partial<RoomResponse>) => void;
  loadDemoRoom: () => void;
  clearRoom: () => void;
  reset: () => void;
}

/**
 * Inputs only. Results are derived with `simulate()` / `scoreGovernance()`
 * where they're rendered, so they can never drift out of sync with the inputs.
 */
export const useSimulatorStore = create<SimulatorState>()((set) => ({
  baseline: DEMO_BASELINE,
  scenario: neutralScenario(DEMO_BASELINE),
  governance: DEMO_GOVERNANCE,
  fork: DEFAULT_FORK,
  priorities: DEFAULT_PRIORITIES,
  room: {},
  setBaseline: (patch) =>
    set((state) => {
      const baseline = { ...state.baseline, ...patch };
      // Debt or EBITDA edits redefine "today", so re-anchor the leverage slider to it.
      const reanchor = "ebitda" in patch || "existingDebt" in patch;
      return {
        baseline,
        scenario: reanchor
          ? { ...state.scenario, leverage: neutralScenario(baseline).leverage }
          : state.scenario,
      };
    }),
  setScenario: (patch) => set((state) => ({ scenario: { ...state.scenario, ...patch } })),
  setGovernance: (patch) => set((state) => ({ governance: { ...state.governance, ...patch } })),
  setFork: (patch) => set((state) => ({ fork: { ...state.fork, ...patch } })),
  setPriorities: (id, patch) =>
    set((state) => ({
      priorities: { ...state.priorities, [id]: { ...state.priorities[id], ...patch } },
    })),
  resetPriorities: (id) =>
    set((state) => ({ priorities: { ...state.priorities, [id]: DEFAULT_PRIORITIES[id] } })),
  setResponse: (id, patch) =>
    set((state) => {
      const current = state.room[id] ?? EMPTY_RESPONSE;
      const editsAnswers = "positions" in patch || "predictions" in patch;
      return {
        room: {
          ...state.room,
          [id]: {
            positions: { ...current.positions, ...patch.positions },
            predictions: { ...current.predictions, ...patch.predictions },
            submitted: patch.submitted ?? (editsAnswers ? false : current.submitted),
          },
        },
      };
    }),
  loadDemoRoom: () => set({ room: DEMO_RESPONSES }),
  clearRoom: () => set({ room: {} }),
  reset: () =>
    set({
      baseline: DEMO_BASELINE,
      scenario: neutralScenario(DEMO_BASELINE),
      governance: DEMO_GOVERNANCE,
      fork: DEFAULT_FORK,
      priorities: DEFAULT_PRIORITIES,
      room: {},
    }),
}));

/** Current Governance Debt Score (0–100). Selecting a number keeps re-renders minimal. */
export const selectGovernanceScore = (state: SimulatorState) =>
  scoreGovernance(state.governance).score;
