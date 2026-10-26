import type { Baseline, BaselineFigures, Scenario } from "./types";

export interface Range {
  min: number;
  max: number;
  step?: number;
}

/** Demo family business preloaded into the simulator. */
export const DEMO_BASELINE: Baseline = {
  revenue: 40,
  ebitda: 12,
  multiple: 8,
  existingDebt: 6,
  interestRate: 0.08,
  founderOwnership: 0.8,
};

/** Accepted bounds for baseline inputs. */
export const BASELINE_LIMITS: Record<keyof BaselineFigures, Range> = {
  revenue: { min: 0, max: 100_000 },
  ebitda: { min: -10_000, max: 10_000 },
  multiple: { min: 0, max: 50 },
  existingDebt: { min: 0, max: 100_000 },
  interestRate: { min: 0, max: 0.3 },
  founderOwnership: { min: 0, max: 1 },
};

/** Slider ranges; also the clamping bounds for scenario values. */
export const SCENARIO_RANGES = {
  leverage: { min: 0, max: 6, step: 0.25 },
  equityTransfer: { min: 0, max: 1, step: 0.05 },
  multipleShock: { min: -0.4, max: 0.4, step: 0.05 },
  ceoCost: { min: 0, max: 5, step: 0.1 },
  ceoUplift: { min: 0, max: 0.2, step: 0.01 },
} satisfies Record<Exclude<keyof Scenario, "outsideCeo">, Range>;

/** NaN falls back to the in-range value nearest zero, so a bad input never reads as an extreme. */
export function clamp(value: number, { min, max }: Range): number {
  if (Number.isNaN(value)) return Math.min(Math.max(0, min), max);
  return Math.min(Math.max(value, min), max);
}

/** The company's current debt / EBITDA, i.e. the "no change" leverage. */
export function currentLeverage(baseline: Baseline): number {
  const ebitda = clamp(baseline.ebitda, BASELINE_LIMITS.ebitda);
  if (ebitda <= 0) return 0;
  return clamp(clamp(baseline.existingDebt, BASELINE_LIMITS.existingDebt) / ebitda, {
    min: 0,
    max: Number.MAX_VALUE,
  });
}

/**
 * Leverage slider bounds for this company. A company already above the usual
 * ceiling keeps its real leverage reachable, so "no change" never forces a paydown.
 */
export function leverageRange(baseline: Baseline): Required<Range> {
  const { min, max, step } = SCENARIO_RANGES.leverage;
  const current = Math.ceil(currentLeverage(baseline) / step) * step;
  return { min, max: Math.max(max, current), step };
}

/** A scenario that changes nothing about the given company. */
export function neutralScenario(baseline: Baseline): Scenario {
  return {
    leverage: currentLeverage(baseline),
    equityTransfer: 0,
    multipleShock: 0,
    outsideCeo: false,
    ceoCost: 1.2,
    ceoUplift: 0.05,
  };
}
