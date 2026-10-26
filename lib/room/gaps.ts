import { STAKEHOLDER_IDS } from "../simulator/alignment";
import { isHeirSeat, orderSeats, seatSchema, stakeholderOf, type SeatId } from "./seats";
import { PREDICTION_TARGET, TOPICS, TOPIC_IDS, isComplete } from "./topics";
import type { Disagreement, Misperception, RoomGaps, RoomResponse, RoomResponses } from "./types";

/** Points on the 1–5 scale at which a gap is worth raising. */
const CAUTION_GAP = 2;
const CRITICAL_GAP = 3;

const severityOf = (gap: number): Disagreement["severity"] =>
  gap >= CRITICAL_GAP ? "critical" : "caution";
const topicIndex = (id: string) => TOPIC_IDS.indexOf(id as (typeof TOPIC_IDS)[number]);

/** Critical first, then the largest gap, then questionnaire order. */
function bySeverity<T extends { severity: string; topicId: string }>(gap: (item: T) => number) {
  return (a: T, b: T) =>
    Number(b.severity === "critical") - Number(a.severity === "critical") ||
    gap(b) - gap(a) ||
    topicIndex(a.topicId) - topicIndex(b.topicId);
}

/**
 * The seats expected to answer: the four stakeholders, plus every heir seat that
 * has a link or answers. Once heirs answer individually, the shared next-gen
 * seat is only expected if it has answers of its own.
 */
export function expectedSeats(responses: RoomResponses, invited: readonly string[] = []): SeatId[] {
  const heirSeats = [...invited, ...Object.keys(responses)].filter(isHeirSeat);
  const shared = heirSeats.length === 0 || responses.nextGen !== undefined;
  return orderSeats([...STAKEHOLDER_IDS.filter((id) => id !== "nextGen" || shared), ...heirSeats]);
}

/**
 * Finds where stakeholders disagree and where they misread each other.
 * Output carries only topics, distances and who-misreads-whom; never anyone's actual answer.
 * Each heir with their own link is a seat: the founder's predictions about
 * "the next generation" are checked against every next-gen seat that answered.
 */
export function detectGaps(responses: RoomResponses, invited: readonly string[] = []): RoomGaps {
  const ready = (id: SeatId): RoomResponse | undefined => {
    const r = responses[id];
    return r?.submitted && isComplete(r.positions) && isComplete(r.predictions) ? r : undefined;
  };
  const seats = expectedSeats(responses, invited.filter((s) => seatSchema.safeParse(s).success));
  const completion: RoomGaps["completion"] = Object.fromEntries(seats.map((id) => [id, ready(id) !== undefined]));
  const submitted = seats.filter((id) => completion[id]);

  const disagreements: Disagreement[] = [];
  if (submitted.length >= 2) {
    for (const { id, statement } of TOPICS) {
      const positions = submitted.map((s) => ready(s)!.positions[id]!);
      const spread = Math.max(...positions) - Math.min(...positions);
      if (spread >= CAUTION_GAP) {
        disagreements.push({ topicId: id, topic: statement, spread, severity: severityOf(spread) });
      }
    }
  }

  const misperceptions: Misperception[] = [];
  for (const observer of submitted) {
    const role = PREDICTION_TARGET[stakeholderOf(observer)];
    for (const target of submitted.filter((seat) => stakeholderOf(seat) === role)) {
      for (const { id, statement } of TOPICS) {
        const gap = Math.abs(ready(observer)!.predictions[id]! - ready(target)!.positions[id]!);
        if (gap >= CAUTION_GAP) {
          misperceptions.push({ topicId: id, topic: statement, observer, target, gap, severity: severityOf(gap) });
        }
      }
    }
  }

  return {
    completion,
    disagreements: disagreements.sort(bySeverity((d) => d.spread)),
    misperceptions: misperceptions.sort(bySeverity((m) => m.gap)),
  };
}
