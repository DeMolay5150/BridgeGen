import { STAKEHOLDER_IDS, type StakeholderId } from "../simulator/alignment";
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
 * Finds where stakeholders disagree and where they misread each other.
 * Output carries only topics, distances and who-misreads-whom; never anyone's actual answer.
 */
export function detectGaps(responses: RoomResponses): RoomGaps {
  const ready = (id: StakeholderId): RoomResponse | undefined => {
    const r = responses[id];
    return r?.submitted && isComplete(r.positions) && isComplete(r.predictions) ? r : undefined;
  };
  const completion = Object.fromEntries(
    STAKEHOLDER_IDS.map((id) => [id, ready(id) !== undefined]),
  ) as RoomGaps["completion"];
  const submitted = STAKEHOLDER_IDS.filter((id) => completion[id]);

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
    const target = PREDICTION_TARGET[observer];
    if (!completion[target]) continue;
    for (const { id, statement } of TOPICS) {
      const gap = Math.abs(ready(observer)!.predictions[id]! - ready(target)!.positions[id]!);
      if (gap >= CAUTION_GAP) {
        misperceptions.push({ topicId: id, topic: statement, observer, target, gap, severity: severityOf(gap) });
      }
    }
  }

  return {
    completion,
    disagreements: disagreements.sort(bySeverity((d) => d.spread)),
    misperceptions: misperceptions.sort(bySeverity((m) => m.gap)),
  };
}
