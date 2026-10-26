import type { OperatingAssumptions } from "../statements/model";

/** Assumptions shared by both branches. Fractions (0.04 = 4%). */
export interface ProjectionAssumptions {
  /** Annual revenue growth; margins are held, so EBITDA grows alike. */
  ebitdaGrowth: number;
}

/** One year of a projected branch. Currency in USD millions. */
export interface YearPoint {
  year: number;
  ebitda: number;
  interest: number;
  /** Levered free cash flow from the cash flow statement (after interest, tax, capex and working capital). */
  freeCashFlow: number;
  /** Scheduled amortization plus the cash sweep. */
  debtPaydown: number;
  /** Revolver drawn to cover a cash shortfall. */
  borrowed: number;
  dividends: number;
  debt: number;
  enterpriseValue: number;
  /** Enterprise value − debt; negative when underwater. */
  equityValue: number;
  /** Equity value floored at zero (limited liability): what counts toward shareholder value. */
  ownersEquity: number;
  /** Day-0 recap (or capital contributed, negative) plus all dividends to date. */
  cumulativeCash: number;
  /** Probability a governance crisis has struck by this year. */
  disruptionProbability: number;
  /** Expected Loss: enterprise value × the maximum governance discount × the chance of a crisis by this year. */
  expectedGovernanceLoss: number;
  /** Owners' equity − Expected Loss + cumulative cash. The headline number. */
  shareholderValue: number;
  founderWealth: number;
  nextGenWealth: number;
  /** EBITDA / interest; null when there is no interest. */
  interestCoverage: number | null;
  flags: {
    underwater: boolean;
    thinCoverage: boolean;
    debtGrowing: boolean;
  };
}

/** Where a branch starts: today, the simulator's live scenario, or a strategy preset id. */
export type BranchSource = "today" | "current" | string;

export interface BranchSpec {
  source: BranchSource;
  /** Model this branch with best-practice governance (score 0). */
  fixGovernance: boolean;
}

/** The Fork the Future page's settings. */
export interface ForkState {
  a: BranchSpec;
  b: BranchSpec;
  assumptions: ProjectionAssumptions;
  /** Three-statement operating inputs (tax, capex, working capital...), saved with the company. */
  statements: OperatingAssumptions;
}
