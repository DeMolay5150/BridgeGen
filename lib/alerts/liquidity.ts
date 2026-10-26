import { PROJECTION_YEARS } from "../projection/horizon";
import { neutralScenario } from "../simulator/defaults";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL, LEVERAGE_CAUTION, LEVERAGE_CRITICAL } from "../simulator/engine";
import { formatMoney } from "../simulator/format";
import type { Baseline, Scenario, Severity } from "../simulator/types";
import { buildStatements, type StatementAssumptions, type StatementModel, type StatementYear } from "../statements/model";

export type AlertKind = "covenantBreach" | "covenantWatch" | "liquidityCrunch" | "cashFlowGap" | "negativeCashFlow";

export interface LiquidityAlert {
  kind: AlertKind;
  severity: Exclude<Severity, "positive">;
  title: string;
  detail: string;
  years: number[];
}

/**
 * A plain downturn for the cash view: revenue −15% and margin −2 points in
 * year 1, flat revenue and −1 point in year 2, then the base case.
 */
export const DOWNTURN_CASE = {
  label: "Downturn",
  growth: [-0.15, 0],
  marginShift: [-0.02, -0.01],
} as const;

/** Changes under $50K are noise. */
const MATERIAL = 0.05;

const yearsLabel = (years: number[]) =>
  years.length === 1 ? `year ${years[0]}` : years.length <= 3 ? `years ${years.join(", ")}` : `years ${years[0]}–${years.at(-1)}`;

const breaches = (y: StatementYear) =>
  y.ebitda <= 0 ||
  (y.interestCoverage !== null && y.interestCoverage < COVERAGE_CRITICAL) ||
  (y.debtToEbitda !== null && y.debtToEbitda > LEVERAGE_CRITICAL);
const watch = (y: StatementYear) =>
  (y.interestCoverage !== null && y.interestCoverage < COVERAGE_CAUTION) ||
  (y.debtToEbitda !== null && y.debtToEbitda >= LEVERAGE_CAUTION);

/** Covenant, liquidity and cash-flow alerts across a projection, worst first. */
export function liquidityAlerts(model: StatementModel): LiquidityAlert[] {
  const years = model.years.slice(1);
  const alerts: LiquidityAlert[] = [];
  const pick = (test: (y: StatementYear) => boolean) => years.filter(test).map((y) => y.year);

  const breached = pick(breaches);
  if (breached.length) {
    alerts.push({
      kind: "covenantBreach",
      severity: "critical",
      title: "Covenant breach",
      detail: `Coverage below 2.0x, debt above 5.0x EBITDA, or EBITDA negative in ${yearsLabel(breached)}.`,
      years: breached,
    });
  }
  const watched = pick((y) => watch(y) && !breaches(y));
  if (watched.length) {
    alerts.push({
      kind: "covenantWatch",
      severity: "caution",
      title: "Covenant watch",
      detail: `Coverage under 3.0x or debt at 4.0x EBITDA or more in ${yearsLabel(watched)}.`,
      years: watched,
    });
  }
  const drawn = years.filter((y) => y.revolverDraw > MATERIAL);
  if (drawn.length) {
    alerts.push({
      kind: "liquidityCrunch",
      severity: "critical",
      title: "Liquidity crunch",
      detail: `Cash runs short: ${formatMoney(drawn.reduce((s, y) => s + y.revolverDraw, 0))} drawn on the revolver in ${yearsLabel(drawn.map((y) => y.year))} to meet scheduled repayments.`,
      years: drawn.map((y) => y.year),
    });
  }
  const negative = years.filter((y) => y.freeCashFlow < -MATERIAL);
  if (negative.length) {
    alerts.push({
      kind: "negativeCashFlow",
      severity: "critical",
      title: "Negative free cash flow",
      detail: `The business consumes cash in ${yearsLabel(negative.map((y) => y.year))}.`,
      years: negative.map((y) => y.year),
    });
  }
  const gaps = years.filter((y) => y.freeCashFlow >= -MATERIAL && y.freeCashFlow + MATERIAL < y.mandatoryRepayment);
  if (gaps.length) {
    const shortfall = gaps.reduce((s, y) => s + (y.mandatoryRepayment - y.freeCashFlow), 0);
    alerts.push({
      kind: "cashFlowGap",
      severity: "caution",
      title: "Cash flow gap",
      detail: `Free cash flow falls ${formatMoney(shortfall)} short of scheduled debt repayments in ${yearsLabel(gaps.map((y) => y.year))}.`,
      years: gaps.map((y) => y.year),
    });
  }
  return alerts.sort((a, b) => Number(b.severity === "critical") - Number(a.severity === "critical"));
}

export interface CaseResult {
  alerts: LiquidityAlert[];
  /** The weakest single year of free cash flow. */
  worstFreeCashFlow: number;
  severity: Severity;
}

function runCase(baseline: Baseline, scenario: Scenario, assumptions: StatementAssumptions, downturn: boolean): CaseResult {
  const growth = downturn
    ? Array.from({ length: PROJECTION_YEARS }, (_, i) => DOWNTURN_CASE.growth[i] ?? assumptions.revenueGrowth)
    : undefined;
  const marginShift = downturn ? Array.from({ length: PROJECTION_YEARS }, (_, i) => DOWNTURN_CASE.marginShift[i] ?? 0) : undefined;
  const model = buildStatements(baseline, scenario, assumptions, { growth, marginShift });
  const alerts = liquidityAlerts(model);
  return {
    alerts,
    worstFreeCashFlow: Math.min(...model.years.slice(1).map((y) => y.freeCashFlow)),
    severity: alerts.some((a) => a.severity === "critical") ? "critical" : alerts.length ? "caution" : "positive",
  };
}

export interface LiquidityComparison {
  today: { base: CaseResult; downturn: CaseResult };
  scenario: { base: CaseResult; downturn: CaseResult };
}

/** Today vs the scenario, each in the base case and the downturn case. */
export function compareLiquidity(baseline: Baseline, scenario: Scenario, assumptions: StatementAssumptions): LiquidityComparison {
  const today = neutralScenario(baseline);
  return {
    today: { base: runCase(baseline, today, assumptions, false), downturn: runCase(baseline, today, assumptions, true) },
    scenario: { base: runCase(baseline, scenario, assumptions, false), downturn: runCase(baseline, scenario, assumptions, true) },
  };
}
