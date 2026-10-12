/**
 * Capital Allocation Flight Simulator domain types.
 * All currency amounts are in USD millions. Rates, shares and percentages
 * are fractions (0.08 = 8%).
 */

/** The company as it stands today. Editable by the advisor. */
export interface Baseline {
  revenue: number;
  ebitda: number;
  /** EV / EBITDA multiple. */
  multiple: number;
  existingDebt: number;
  /** Annual interest rate on all debt. */
  interestRate: number;
  /** Founder's share of equity; the remainder is held by other shareholders. */
  founderOwnership: number;
}

/** The decision being simulated. Driven by the sliders. */
export interface Scenario {
  /** Target total debt / baseline EBITDA. */
  leverage: number;
  /** Share of the founder's stake transferred to the next generation. */
  equityTransfer: number;
  /** Change applied to the baseline multiple (-0.2 = 20% lower). */
  multipleShock: number;
  outsideCeo: boolean;
  /** Outside CEO all-in annual cost. */
  ceoCost: number;
  /** EBITDA improvement attributed to the outside CEO. */
  ceoUplift: number;
}

/** Maps to the theme's signal tokens (text-positive, text-caution, text-critical). */
export type Severity = "positive" | "caution" | "critical";

export interface RiskSignal {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface Holders<T = number> {
  founder: T;
  nextGen: T;
  others: T;
}

export interface SimulationResult {
  adjustedEbitda: number;
  /** Adjusted EBITDA / revenue; null when revenue is zero. */
  ebitdaMargin: number | null;
  effectiveMultiple: number;
  enterpriseValue: number;
  totalDebt: number;
  /**
   * Total debt minus existing debt. Positive: paid out to shareholders as a
   * dividend recap. Negative: capital shareholders must contribute to deleverage.
   */
  netDistribution: number;
  /** Enterprise value minus total debt. Negative means equity is underwater. */
  equityValue: number;
  /** Post-transfer ownership shares (sum to 1). */
  ownership: Holders;
  /** Each holder's equity value, floored at zero (limited liability). */
  holderEquity: Holders;
  /** Each holder's share of the net distribution. */
  holderDistribution: Holders;
  interestExpense: number;
  /** Adjusted EBITDA / interest expense; null when there is no interest. */
  interestCoverage: number | null;
  /** Total debt / adjusted EBITDA; null when adjusted EBITDA is not positive. */
  debtToEbitda: number | null;
  /** Value at risk from governance gaps (USD millions); 0 when no score is supplied. */
  governanceDebt: number;
  signals: RiskSignal[];
}
