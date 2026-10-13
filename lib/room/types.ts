import type { StakeholderId } from "../simulator/alignment";
import type { Severity } from "../simulator/types";

export type TopicId =
  | "nextGenReady"
  | "founderControl"
  | "outsideCeo"
  | "takeCash"
  | "governanceAdequate"
  | "sellWithin10";

/** 1 = strongly disagree … 5 = strongly agree. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export type Answers = Partial<Record<TopicId, Rating>>;

/** One stakeholder's private questionnaire. */
export interface RoomResponse {
  /** Their own view on each topic. */
  positions: Answers;
  /** How they expect their prediction target to answer. */
  predictions: Answers;
  /** Only submitted responses are used for gap detection. */
  submitted: boolean;
}

export type RoomResponses = Partial<Record<StakeholderId, RoomResponse>>;

/** Stakeholders' positions are far apart. Never says who holds which view. */
export interface Disagreement {
  topicId: TopicId;
  topic: string;
  /** Highest minus lowest position (points on the 1–5 scale). */
  spread: number;
  severity: Exclude<Severity, "positive">;
}

/** A stakeholder misjudges how another answered. Never reveals either answer. */
export interface Misperception {
  topicId: TopicId;
  topic: string;
  observer: StakeholderId;
  target: StakeholderId;
  /** Distance between the prediction and the actual answer. */
  gap: number;
  severity: Exclude<Severity, "positive">;
}

export interface RoomGaps {
  completion: Record<StakeholderId, boolean>;
  disagreements: Disagreement[];
  misperceptions: Misperception[];
}
