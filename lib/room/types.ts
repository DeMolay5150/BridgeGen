import type { Severity } from "../simulator/types";
import type { SeatId } from "./seats";

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

export type RoomResponses = Partial<Record<SeatId, RoomResponse>>;

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
  observer: SeatId;
  target: SeatId;
  /** Distance between the prediction and the actual answer. */
  gap: number;
  severity: Exclude<Severity, "positive">;
}

export interface RoomGaps {
  /** Every seat expected to answer, in room order (see `orderSeats`), and whether it has. */
  completion: Partial<Record<SeatId, boolean>>;
  disagreements: Disagreement[];
  misperceptions: Misperception[];
}
