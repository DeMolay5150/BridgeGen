import { create } from "zustand";
import { DEMO_GOVERNANCE, scoreGovernance } from "../governance/model";
import type { GovernanceAnswers } from "../governance/types";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import type { Baseline, Scenario } from "./types";

interface SimulatorState {
  baseline: Baseline;
  scenario: Scenario;
  governance: GovernanceAnswers;
  setBaseline: (patch: Partial<Baseline>) => void;
  setScenario: (patch: Partial<Scenario>) => void;
  setGovernance: (patch: Partial<GovernanceAnswers>) => void;
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
  reset: () =>
    set({
      baseline: DEMO_BASELINE,
      scenario: neutralScenario(DEMO_BASELINE),
      governance: DEMO_GOVERNANCE,
    }),
}));

/** Current Governance Debt Score (0–100). Selecting a number keeps re-renders minimal. */
export const selectGovernanceScore = (state: SimulatorState) =>
  scoreGovernance(state.governance).score;
