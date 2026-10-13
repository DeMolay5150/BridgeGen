import { neutralScenario } from "../simulator/defaults";
import { formatMultiple, formatPercent, formatSignedPercent } from "../simulator/format";
import type { Baseline, Scenario } from "../simulator/types";
import type { Driver } from "./types";

interface Lever {
  label: (s: Scenario) => string;
  active: (s: Scenario, today: Scenario) => boolean;
  reset: (s: Scenario, today: Scenario) => Scenario;
}

const LEVERS: Lever[] = [
  {
    label: (s) => `Debt leverage ${formatMultiple(s.leverage)}`,
    active: (s, t) => Math.abs(s.leverage - t.leverage) > 1e-9,
    reset: (s, t) => ({ ...s, leverage: t.leverage }),
  },
  {
    label: (s) => `Equity transfer ${formatPercent(s.equityTransfer)}`,
    active: (s) => s.equityTransfer > 0,
    reset: (s) => ({ ...s, equityTransfer: 0 }),
  },
  {
    label: (s) => `Valuation shift ${formatSignedPercent(s.multipleShock)}`,
    active: (s) => Math.abs(s.multipleShock) > 1e-9,
    reset: (s) => ({ ...s, multipleShock: 0 }),
  },
  {
    label: () => "Outside CEO",
    active: (s) => s.outsideCeo,
    reset: (s) => ({ ...s, outsideCeo: false }),
  },
];

export const INTERACTION_LABEL = "Interaction between levers";

/**
 * Attributes the change in an outcome (versus today) to each active lever by
 * re-running the model with only that lever reset. Levers interact, so any
 * part of the change the single-lever effects don't explain is reported as
 * its own row instead of being silently spread across the levers.
 */
export function attribute(
  baseline: Baseline,
  scenario: Scenario,
  metric: (s: Scenario) => number | null,
  options: {
    format: (magnitude: number) => string;
    higherIsBetter?: boolean;
    /** Effects smaller than this are not worth showing. */
    materiality?: number;
  },
): Driver[] {
  const { format, higherIsBetter = true, materiality = 1e-6 } = options;
  const today = neutralScenario(baseline);
  const full = metric(scenario);
  const atToday = metric(today);
  if (full === null || atToday === null) return [];

  const active = LEVERS.filter((lever) => lever.active(scenario, today));
  const effects: { lever: string; effect: number }[] = [];
  for (const lever of active) {
    const without = metric(lever.reset(scenario, today));
    // An outcome that doesn't exist without this lever (e.g. coverage with no debt) can't be split fairly.
    if (without === null) return [];
    effects.push({ lever: lever.label(scenario), effect: full - without });
  }

  const remainder = full - atToday - effects.reduce((sum, e) => sum + e.effect, 0);
  if (Math.abs(remainder) >= materiality) effects.push({ lever: INTERACTION_LABEL, effect: remainder });

  return effects
    .filter((e) => Math.abs(e.effect) >= materiality)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .map(({ lever, effect }) => ({
      lever,
      effect,
      display: `${effect >= 0 ? "+" : "−"}${format(Math.abs(effect))}`,
      tone: effect >= 0 === higherIsBetter ? "positive" : "critical",
    }));
}
