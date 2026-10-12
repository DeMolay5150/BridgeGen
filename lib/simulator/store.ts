import { create } from "zustand";
import { DEMO_BASELINE, neutralScenario } from "./defaults";
import type { Baseline, Scenario } from "./types";

interface SimulatorState {
  baseline: Baseline;
  scenario: Scenario;
  setBaseline: (patch: Partial<Baseline>) => void;
  setScenario: (patch: Partial<Scenario>) => void;
  reset: () => void;
}

/**
 * Inputs only. Results are derived with `simulate()` where they're rendered,
 * so they can never drift out of sync with the inputs.
 */
export const useSimulatorStore = create<SimulatorState>()((set) => ({
  baseline: DEMO_BASELINE,
  scenario: neutralScenario(DEMO_BASELINE),
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
  reset: () => set({ baseline: DEMO_BASELINE, scenario: neutralScenario(DEMO_BASELINE) }),
}));
