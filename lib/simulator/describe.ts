import { formatMoney, formatMultiple, formatPercent, formatSignedPercent } from "./format";
import type { Scenario } from "./types";

/** Plain-language summary of a scenario's levers, e.g. "3.0x leverage · 40% to heirs · governance 78/100". */
export function describeScenario(scenario: Scenario, governanceScore: number): string {
  const parts = [`${formatMultiple(scenario.leverage)} leverage`];
  if (scenario.equityTransfer > 0) parts.push(`${formatPercent(scenario.equityTransfer)} to heirs`);
  if (Math.abs(scenario.multipleShock) >= 0.005) parts.push(`${formatSignedPercent(scenario.multipleShock)} multiple`);
  if (scenario.outsideCeo) parts.push(`outside CEO (${formatMoney(scenario.ceoCost)})`);
  parts.push(`governance ${Math.round(governanceScore)}/100`);
  return parts.join(" · ");
}
