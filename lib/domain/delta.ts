import { formatSignedMoney } from "../simulator/format";

/**
 * A change in one KPI against a reference (usually Today), shared by the
 * Simulator cards, the PDF report and the decks so all of them judge and
 * print a change the same way.
 */
export interface KpiDelta {
  change: number;
  /** e.g. "+$4.0M", "−1.2x"; "–" when flat. */
  display: string;
  direction: "up" | "down" | "flat";
  /** Good for shareholders, bad, or not judged (flat, or e.g. new debt for a recap). */
  good: boolean | null;
}

/** Money moves under $50K and ratio moves under 0.05x read as flat. */
export const MONEY_TOLERANCE = 0.05;
export const MULTIPLE_TOLERANCE = 0.05;
export const FLAT_DISPLAY = "–";

function delta(change: number, display: string, higherIsBetter: boolean | null, tolerance: number): KpiDelta {
  const flat = Math.abs(change) < tolerance;
  return {
    change,
    display: flat ? FLAT_DISPLAY : display,
    direction: flat ? "flat" : change > 0 ? "up" : "down",
    good: flat || higherIsBetter === null ? null : change > 0 === higherIsBetter,
  };
}

/** Change in a USD-millions figure. */
export function moneyDelta(now: number, then: number, higherIsBetter: boolean | null = true): KpiDelta {
  const change = now - then;
  return delta(change, formatSignedMoney(change), higherIsBetter, MONEY_TOLERANCE);
}

/** Change in a multiple (coverage, leverage); null when either side has none (e.g. no debt). */
export function multipleDelta(now: number | null, then: number | null, higherIsBetter: boolean): KpiDelta | null {
  if (now === null || then === null) return null;
  const change = now - then;
  return delta(change, `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}x`, higherIsBetter, MULTIPLE_TOLERANCE);
}
