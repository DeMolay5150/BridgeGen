import type { GovernanceCategoryId } from "../governance/types";
import type { Severity } from "../simulator/types";

export type ShockId = "incapacitation" | "successorExit" | "downturn" | "perfectStorm";

/** What a shock does to the company. Fractions (0.1 = 10%); debt in USD millions. */
export interface ShockChanges {
  ebitdaCut: number;
  multipleCut: number;
  /** New debt taken on, e.g. to buy out an exiting heir. */
  extraDebt: number;
  /** Added to the interest rate (0.02 = +2 points). */
  rateIncrease: number;
}

/** Balance-sheet snapshot before or after a shock. */
export interface StressMetrics {
  ebitda: number;
  enterpriseValue: number;
  debt: number;
  equityValue: number;
  interestCoverage: number | null;
  debtToEbitda: number | null;
}

export type Verdict = "survives" | "strained" | "breaks";

export interface GovernanceDividend {
  categories: GovernanceCategoryId[];
  /** The shock's changes if those categories were best practice. */
  changes: ShockChanges;
  /** Value destroyed that best-practice governance would avoid (USD millions). */
  valueSaved: number;
}

export interface ShockResult {
  id: ShockId;
  name: string;
  description: string;
  changes: ShockChanges;
  before: StressMetrics;
  after: StressMetrics;
  /** Equity before − (equity after + cash paid out to an exiting heir). */
  valueDestroyed: number;
  verdict: Verdict;
  warnings: string[];
  /** Null when the relevant governance is already best practice. */
  dividend: GovernanceDividend | null;
}

export type BreakingPointId = "coverage" | "leverage" | "equityByEbitda" | "equityByMultiple";

export interface BreakingPoint {
  id: BreakingPointId;
  /** What breaks, e.g. "Interest coverage falls below 2.0x". */
  limit: string;
  /** What has to fall for it to break. */
  driver: "EBITDA" | "Multiple";
  /** Smallest decline (0–1) that breaks the limit; 0 = already broken; null = cannot break. */
  threshold: number | null;
  severity: Severity;
}
