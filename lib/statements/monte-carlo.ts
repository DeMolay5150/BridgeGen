import { PROJECTION_YEARS } from "../projection/model";
import { COVERAGE_CRITICAL, LEVERAGE_CRITICAL } from "../simulator/engine";
import type { Baseline, Scenario } from "../simulator/types";
import { buildStatements, type StatementAssumptions } from "./model";

/** Uncertainty around the base case. Standard deviations; growth and margin vary yearly. */
export interface MonteCarloSettings {
  paths: number;
  /** Fixed, so the same inputs always produce the same distribution. */
  seed: number;
  growthVolatility: number;
  marginVolatility: number;
  multipleVolatility: number;
  /** Year at which outcomes are read. */
  horizon: number;
}

export const DEFAULT_MONTE_CARLO: MonteCarloSettings = {
  paths: 1_000,
  seed: 20_261_014,
  growthVolatility: 0.06,
  marginVolatility: 0.02,
  multipleVolatility: 0.15,
  horizon: 5,
};

export interface Percentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  settings: MonteCarloSettings;
  /** Share of paths that break 2.0x coverage or 5.0x leverage in any year up to the horizon. */
  covenantBreachProbability: number;
  /** Share of paths whose equity is wiped out at the horizon. */
  equityWipeoutProbability: number;
  equityValue: Percentiles;
  /** Percentiles of the 10-year equity IRR, over paths where it exists. */
  equityIrr: Percentiles | null;
  /** Equity value at the horizon, bucketed for a histogram. */
  histogram: { from: number; to: number; count: number }[];
  /** Equity value at the horizon in the deterministic base case, for reference. */
  baseCaseEquityValue: number;
}

/** Mulberry32: small, fast, seedable. Not for cryptography. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Standard normal draws via Box–Muller. */
function normal(random: () => number): () => number {
  return () => {
    const u = Math.max(random(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  };
}

/** Nearest-rank percentile of an ascending array. */
function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
}

const percentiles = (values: number[]): Percentiles => {
  const sorted = [...values].sort((a, b) => a - b);
  return { p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
};

const BUCKETS = 20;

function histogramOf(values: number[]): MonteCarloResult["histogram"] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = max > min ? (max - min) / BUCKETS : 1;
  const buckets = Array.from({ length: BUCKETS }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  for (const v of values) buckets[Math.min(BUCKETS - 1, Math.floor((v - min) / width))].count++;
  return buckets;
}

/**
 * Runs the three-statement model down many randomized paths: yearly revenue
 * growth and EBITDA margin wobble around the base case, and the exit multiple
 * shifts once per path. Seeded, so it's deterministic and explainable.
 */
export function runMonteCarlo(
  baseline: Baseline,
  scenario: Scenario,
  assumptions: StatementAssumptions,
  settings: MonteCarloSettings = DEFAULT_MONTE_CARLO,
): MonteCarloResult {
  const draw = normal(mulberry32(settings.seed));
  const horizon = Math.min(Math.max(Math.round(settings.horizon), 1), PROJECTION_YEARS);
  const equityValues: number[] = [];
  const irrs: number[] = [];
  let breaches = 0;
  let wipeouts = 0;

  const paths = Math.max(1, Math.round(settings.paths));
  for (let path = 0; path < paths; path++) {
    const growth = Array.from({ length: PROJECTION_YEARS }, () => assumptions.revenueGrowth + settings.growthVolatility * draw());
    const marginShift = Array.from({ length: PROJECTION_YEARS }, () => settings.marginVolatility * draw());
    // A multiple can halve or rise, but never go negative.
    const multipleShift = Math.max(-0.9, settings.multipleVolatility * draw());
    const model = buildStatements(baseline, scenario, assumptions, { growth, marginShift, multipleShift });

    const window = model.years.slice(1, horizon + 1);
    const breached = window.some(
      (y) =>
        y.ebitda <= 0 ||
        (y.interestCoverage !== null && y.interestCoverage < COVERAGE_CRITICAL) ||
        (y.debtToEbitda !== null && y.debtToEbitda > LEVERAGE_CRITICAL),
    );
    if (breached) breaches++;
    const equity = model.years[horizon].equityValue;
    if (equity <= 0) wipeouts++;
    equityValues.push(equity);
    if (model.equityIrr !== null) irrs.push(model.equityIrr);
  }

  return {
    settings: { ...settings, horizon },
    covenantBreachProbability: breaches / paths,
    equityWipeoutProbability: wipeouts / paths,
    equityValue: percentiles(equityValues),
    equityIrr: irrs.length ? percentiles(irrs) : null,
    histogram: histogramOf(equityValues),
    baseCaseEquityValue: buildStatements(baseline, scenario, assumptions).years[horizon].equityValue,
  };
}
