import type { GovernanceCategoryId } from "../governance/types";
import { formatMoney, formatPercent } from "../simulator/format";
import type { ShockChanges } from "./types";

/** What "fixing" each governance category means, in a sentence fragment. */
export const GOVERNANCE_AREA: Record<GovernanceCategoryId, string> = {
  authority: "authority and succession planning",
  board: "board",
  voting: "shareholder agreements",
};

/** e.g. "EBITDA −17.4% · multiple −17.4% · +$31.5M debt · rates +2 pts". */
export function describeChanges(c: ShockChanges): string {
  const pct = (v: number) => formatPercent(v, 1);
  const parts: string[] = [];
  if (c.ebitdaCut > 0) parts.push(`EBITDA −${pct(c.ebitdaCut)}`);
  if (c.multipleCut > 0) parts.push(`multiple −${pct(c.multipleCut)}`);
  if (c.extraDebt > 0) parts.push(`+${formatMoney(c.extraDebt)} debt`);
  if (c.rateIncrease > 0) parts.push(`rates +${(c.rateIncrease * 100).toFixed(0)} pts`);
  return parts.join(" · ") || "No direct impact";
}
