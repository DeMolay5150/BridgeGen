import { COVERAGE_CRITICAL, LEVERAGE_CRITICAL } from "../simulator/engine";
import { formatMultiple } from "../simulator/format";
import type { SimulationResult } from "../simulator/types";
import type { BreakingPoint } from "./types";

/** A breaking point closer than this is critical; closer than CAUTION is a warning. */
const CRITICAL_DISTANCE = 0.15;
const CAUTION_DISTANCE = 0.3;

function severityOf(threshold: number | null): BreakingPoint["severity"] {
  if (threshold === null) return "positive";
  if (threshold < CRITICAL_DISTANCE) return "critical";
  if (threshold < CAUTION_DISTANCE) return "caution";
  return "positive";
}

/** The decline at which `remaining` of the original value is left; clamped to 0–1. */
const declineTo = (remaining: number) => Math.min(Math.max(1 - remaining, 0), 1);

/**
 * How far EBITDA or the multiple can fall before each lender or equity limit
 * breaks. Closed-form, so exact: each limit is linear in the decline.
 */
export function breakingPoints(result: SimulationResult, interestRate: number): BreakingPoint[] {
  const ebitda = result.adjustedEbitda;
  const debt = result.totalDebt;
  const multiple = result.effectiveMultiple;
  const rate = Number.isFinite(interestRate) ? Math.max(interestRate, 0) : 0;

  // Coverage: ebitda(1 − d) / (debt × rate) < 2  ⇔  d > 1 − 2·debt·rate / ebitda
  const coverage =
    debt * rate <= 0 ? null : ebitda <= 0 ? 0 : declineTo((COVERAGE_CRITICAL * debt * rate) / ebitda);
  // Leverage: debt / (ebitda(1 − d)) > 5  ⇔  d > 1 − debt / (5·ebitda)
  const leverage =
    debt <= 0 ? null : ebitda <= 0 ? 0 : declineTo(debt / (LEVERAGE_CRITICAL * ebitda));
  // Equity: ebitda(1 − d)·multiple − debt ≤ 0  ⇔  d ≥ 1 − debt / (ebitda·multiple); same for the multiple.
  const equity =
    debt <= 0 ? null : ebitda <= 0 || multiple <= 0 ? 0 : declineTo(debt / (ebitda * multiple));

  const points: BreakingPoint[] = [
    { id: "coverage", limit: `Interest coverage falls below ${formatMultiple(COVERAGE_CRITICAL)}`, driver: "EBITDA", threshold: coverage, severity: severityOf(coverage) },
    { id: "leverage", limit: `Debt rises above ${formatMultiple(LEVERAGE_CRITICAL)} EBITDA`, driver: "EBITDA", threshold: leverage, severity: severityOf(leverage) },
    { id: "equityByEbitda", limit: "Equity is wiped out", driver: "EBITDA", threshold: equity, severity: severityOf(equity) },
    { id: "equityByMultiple", limit: "Equity is wiped out", driver: "Multiple", threshold: equity, severity: severityOf(equity) },
  ];

  // Closest breaking point first; limits that can't break go last.
  return points.sort((a, b) => (a.threshold ?? Infinity) - (b.threshold ?? Infinity));
}
