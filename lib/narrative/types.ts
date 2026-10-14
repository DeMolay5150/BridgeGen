import type { Severity } from "../simulator/types";

/**
 * An investment-committee style summary: the bottom line first, the evidence
 * behind it, then what to do. Every figure is taken from engine outputs;
 * nothing here is generated or re-estimated.
 */
export interface ExecutiveBrief {
  /** Bottom line up front, in one sentence. */
  headline: string;
  tone: Severity;
  /** The evidence behind the headline, with the engine's figures. */
  findings: string[];
  /** What to do about it, most valuable first. */
  actions: string[];
}
