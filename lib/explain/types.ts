import type { Severity } from "../simulator/types";

/** One link in a cause-and-effect chain, with the real figures substituted. */
export interface ExplanationStep {
  text: string;
  tone?: Severity;
}

/** How much one lever of the decision moved an outcome. */
export interface Driver {
  lever: string;
  /** Signed change in the outcome caused by this lever. */
  effect: number;
  /** e.g. "−$30.0M" */
  display: string;
  /** Whether the effect helps (positive) or hurts (critical) the stakeholders. */
  tone: Extract<Severity, "positive" | "critical">;
}

export interface Explanation {
  title: string;
  summary: string;
  steps: ExplanationStep[];
  drivers?: Driver[];
  note?: string;
}
