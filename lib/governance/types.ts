/** A governance practice is in place, partly in place, or missing. */
export type Practice = "yes" | "partial" | "no";

export type MeetingCadence = "quarterly" | "annual" | "adhoc";

/** The advisor's governance assessment of the company. */
export interface GovernanceAnswers {
  delegationOfAuthority: Practice;
  successionPlan: Practice;
  incapacitationPlan: Practice;
  boardSeatsFilled: number;
  boardSeatsRecommended: number;
  independentDirectors: number;
  meetingCadence: MeetingCadence;
  buySellAgreement: Practice;
  votingRules: Practice;
  disputeResolution: Practice;
}

export type GovernanceCategoryId = "authority" | "board" | "voting";

export interface GovernanceItemScore {
  id: keyof GovernanceAnswers | "boardSeats";
  label: string;
  category: GovernanceCategoryId;
  /** Points of governance debt this item contributes (0..maxPoints). */
  points: number;
  maxPoints: number;
}

export interface GovernanceCategoryScore {
  id: GovernanceCategoryId;
  label: string;
  points: number;
  maxPoints: number;
}

export interface GovernanceScore {
  /** 0 = best practice, 100 = no formal governance at all. */
  score: number;
  items: GovernanceItemScore[];
  categories: GovernanceCategoryScore[];
}
