import { neutralScenario } from "./defaults";
import type { Baseline, Scenario } from "./types";

export interface Strategy {
  id: string;
  name: string;
  description: string;
  /** Applied on top of the neutral scenario, so strategies follow an edited baseline. */
  patch: Partial<Scenario>;
}

export const STRATEGIES: Strategy[] = [
  { id: "today", name: "Today", description: "No change to the business", patch: {} },
  {
    id: "dividend-recap",
    name: "Dividend recap",
    description: "Borrow to 3.0x EBITDA and pay the cash out",
    patch: { leverage: 3 },
  },
  {
    id: "gradual-transition",
    name: "Gradual transition",
    description: "Transfer 40% of the founder's stake to heirs",
    patch: { equityTransfer: 0.4 },
  },
  {
    id: "full-handoff",
    name: "Full heir handoff",
    description: "Transfer the founder's entire stake to heirs",
    patch: { equityTransfer: 1 },
  },
  {
    id: "outside-ceo",
    name: "Outside CEO",
    description: "Hire a $1.2M professional CEO targeting a 5% EBITDA uplift",
    patch: { outsideCeo: true, ceoCost: 1.2, ceoUplift: 0.05 },
  },
];

export function strategyScenario(baseline: Baseline, strategy: Strategy): Scenario {
  return { ...neutralScenario(baseline), ...strategy.patch };
}
