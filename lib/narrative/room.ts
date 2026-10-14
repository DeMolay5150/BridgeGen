import type { RoomGaps } from "../room/types";
import { STAKEHOLDER_IDS, STAKEHOLDER_LABELS, type StakeholderId } from "../simulator/alignment";
import type { ExecutiveBrief } from "./types";

const label = (id: StakeholderId) => STAKEHOLDER_LABELS[id].toLowerCase();

/** "the board", "the board and the lender", "the founder, the board and the lender". */
function listOf(ids: StakeholderId[]): string {
  const names = ids.map((id) => `the ${label(id)}`);
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Executive summary of the Decision Room. Built from `detectGaps()` output
 * only (topics, distances, who misreads whom), so it can never reveal
 * anyone's actual answers.
 */
export function roomBrief(gaps: RoomGaps): ExecutiveBrief {
  const submitted = STAKEHOLDER_IDS.filter((id) => gaps.completion[id]);
  const missing = STAKEHOLDER_IDS.filter((id) => !gaps.completion[id]);
  const collect = missing.length ? [`Collect the views of ${listOf(missing)} before the decision is taken.`] : [];

  if (submitted.length < 2) {
    return {
      headline: `The Decision Room is still collecting views: ${submitted.length} of ${STAKEHOLDER_IDS.length} stakeholders have submitted, too few to compare.`,
      tone: "caution",
      findings: ["Gaps appear once at least two stakeholders, including someone and the person they predict, have submitted."],
      actions: collect,
    };
  }

  const { disagreements, misperceptions } = gaps;
  const critical = [...disagreements, ...misperceptions].filter((g) => g.severity === "critical").length;
  if (disagreements.length + misperceptions.length === 0) {
    return {
      headline: `Stakeholders are aligned: no material disagreements or misperceptions across ${submitted.length} submitted views.`,
      tone: "positive",
      findings: ["Every stakeholder read the others accurately, and no topic splits the room by two points or more."],
      actions: collect.length ? collect : ["Proceed, and re-run the room if the decision or the people around it change."],
    };
  }

  const findings: string[] = [];
  const contested = disagreements[0];
  if (contested) findings.push(`Most contested: “${contested.topic}”, ${contested.spread} points apart on a 5-point scale.`);
  const misread = misperceptions[0];
  if (misread) findings.push(`The ${label(misread.observer)} misreads the ${label(misread.target)} on “${misread.topic}”.`);
  if (missing.length) findings.push(`${capitalize(listOf(missing))} ${missing.length === 1 ? "has" : "have"} yet to submit; the picture may shift.`);

  // One conversation per pair: the founder misreading the heir and vice versa is a single meeting.
  const pairKey = (a: StakeholderId, b: StakeholderId) => [a, b].sort((x, y) => STAKEHOLDER_IDS.indexOf(x) - STAKEHOLDER_IDS.indexOf(y)).join(":");
  const pairs = [...new Set(misperceptions.map((m) => pairKey(m.observer, m.target)))].map((pair) => pair.split(":") as StakeholderId[]);
  const actions = [
    ...pairs.map(([observer, target]) => `Facilitate a structured conversation between the ${label(observer)} and the ${label(target)} before committing capital.`),
    ...(contested ? [`Put “${contested.topic}” on the next family-council agenda, with an independent chair.`] : []),
    ...collect,
  ];

  return {
    headline: `Alignment is the gating risk: ${plural(disagreements.length, "contested topic", "contested topics")} and ${plural(misperceptions.length, "misperception", "misperceptions")} (${critical} critical) across ${submitted.length} stakeholders.`,
    tone: critical > 0 ? "critical" : "caution",
    findings,
    actions,
  };
}
