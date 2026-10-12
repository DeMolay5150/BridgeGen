import { neutralScenario } from "../simulator/defaults";
import { STRATEGIES, strategyScenario } from "../simulator/strategies";
import type { Baseline, Scenario } from "../simulator/types";
import type { BranchSource, BranchSpec } from "./types";

export interface BranchOption {
  value: BranchSource;
  label: string;
}

/** Starting points a branch can take: today, the live scenario, then each preset. */
export const BRANCH_OPTIONS: BranchOption[] = [
  { value: "today", label: "Today (no change)" },
  { value: "current", label: "Your scenario" },
  ...STRATEGIES.filter((s) => s.id !== "today").map((s) => ({ value: s.id, label: s.name })),
];

export interface ResolvedBranch {
  label: string;
  scenario: Scenario;
  governanceScore: number;
}

export function resolveBranch(
  spec: BranchSpec,
  context: { baseline: Baseline; scenario: Scenario; governanceScore: number },
): ResolvedBranch {
  const label = BRANCH_OPTIONS.find((o) => o.value === spec.source)?.label ?? "Today (no change)";
  const strategy = STRATEGIES.find((s) => s.id === spec.source);
  const scenario =
    spec.source === "current"
      ? context.scenario
      : strategy
        ? strategyScenario(context.baseline, strategy)
        : neutralScenario(context.baseline);
  return {
    label: spec.fixGovernance ? `${label} + governance fixed` : label,
    scenario,
    // Branch-local: fixing governance here never touches the real answers.
    governanceScore: spec.fixGovernance ? 0 : context.governanceScore,
  };
}
