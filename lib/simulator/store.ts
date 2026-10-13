import { create } from "zustand";
import { scoreGovernance } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { defaultSnapshot, type CompanySnapshot } from "../persistence/serialize";
import type { ForkState } from "../projection/types";
import { DEMO_RESPONSES } from "../room/topics";
import type { RoomResponse, RoomResponses } from "../room/types";
import {
  DEFAULT_PRIORITIES,
  type PriorityKey,
  type Priorities,
  type StakeholderId,
} from "./alignment";
import { neutralScenario } from "./defaults";
import type { Baseline, Scenario } from "./types";

export type { ForkState };

const EMPTY_RESPONSE: RoomResponse = { positions: {}, predictions: {}, submitted: false };

interface SimulatorState extends CompanySnapshot {
  /** The saved company being edited, or null for the in-memory public demo. */
  companyId: string | null;
  companyName: string | null;
  /** Decision Room questionnaires answered on this device (demo mode). Never persisted. */
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
  loadCompany: (company: { id: string; name: string; snapshot: CompanySnapshot }) => void;
  setCompanyName: (name: string) => void;
  exitToDemo: () => void;
  /**
   * Demo: back to the demo company. Saved company: resets only the decision
   * levers, so one click never overwrites a client's figures.
   */
  reset: () => void;
}

/**
 * Inputs only. Results are derived with `simulate()` / `scoreGovernance()`
 * where they're rendered, so they can never drift out of sync with the inputs.
 */
export const useSimulatorStore = create<SimulatorState>()((set) => ({
  ...defaultSnapshot(),
  companyId: null,
  companyName: null,
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
  loadCompany: ({ id, name, snapshot }) => set({ ...snapshot, companyId: id, companyName: name, room: {} }),
  setCompanyName: (name) => set({ companyName: name }),
  exitToDemo: () => set({ ...defaultSnapshot(), companyId: null, companyName: null, room: {} }),
  reset: () =>
    set((state) =>
      state.companyId
        ? { scenario: neutralScenario(state.baseline), room: {} }
        : { ...defaultSnapshot(), room: {} },
    ),
}));

/** Current Governance Debt Score (0–100). Selecting a number keeps re-renders minimal. */
export const selectGovernanceScore = (state: SimulatorState) =>
  scoreGovernance(state.governance).score;

/** The saved part of the state. */
export const selectSnapshot = (state: SimulatorState): CompanySnapshot => ({
  baseline: state.baseline,
  scenario: state.scenario,
  governance: state.governance,
  fork: state.fork,
  priorities: state.priorities,
});

/** Exposed for persistence code that subscribes outside React. */
export type { SimulatorState, Priorities };
