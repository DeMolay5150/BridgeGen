import type { StakeholderId } from "../simulator/alignment";
import type { Answers, Rating, RoomResponses, TopicId } from "./types";

export const TOPICS: { id: TopicId; statement: string }[] = [
  { id: "nextGenReady", statement: "The next generation is ready to lead within 3 years" },
  { id: "founderControl", statement: "The founder should keep control for the next 5 years" },
  { id: "outsideCeo", statement: "An outside CEO would be acceptable" },
  { id: "takeCash", statement: "The family should take cash out rather than reinvest" },
  { id: "governanceAdequate", statement: "Our governance is adequate today" },
  { id: "sellWithin10", statement: "The business should be sold within 10 years" },
];

export const TOPIC_IDS = TOPICS.map((t) => t.id);

export const RATING_LABELS: Record<Rating, string> = {
  1: "Strongly disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly agree",
};

/** Whose answers each stakeholder predicts. */
export const PREDICTION_TARGET: Record<StakeholderId, StakeholderId> = {
  founder: "nextGen",
  nextGen: "founder",
  board: "founder",
  lender: "founder",
};

export function isComplete(answers: Answers): boolean {
  return TOPIC_IDS.every((id) => answers[id] !== undefined);
}

const answers = (...ratings: Rating[]): Answers =>
  Object.fromEntries(TOPIC_IDS.map((id, i) => [id, ratings[i]]));

/**
 * Scripted demo: the founder believes the heir is ready and assumes the heir
 * agrees; the heir doesn't feel ready and would welcome an outside CEO.
 * Order: ready, control, outside CEO, take cash, governance adequate, sell.
 */
export const DEMO_RESPONSES: RoomResponses = {
  founder: { positions: answers(5, 5, 1, 2, 4, 1), predictions: answers(5, 4, 1, 2, 4, 1), submitted: true },
  nextGen: { positions: answers(2, 2, 4, 4, 2, 3), predictions: answers(3, 5, 1, 2, 4, 1), submitted: true },
  board: { positions: answers(2, 2, 4, 2, 2, 2), predictions: answers(4, 5, 2, 2, 3, 1), submitted: true },
  lender: { positions: answers(3, 3, 4, 2, 2, 3), predictions: answers(4, 4, 2, 3, 3, 2), submitted: true },
};
