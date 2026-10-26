import { governanceDebtValue } from "../governance/model";
import { BASELINE_LIMITS, SCENARIO_RANGES, clamp, leverageRange } from "./defaults";
import { formatMoney, formatMultiple, formatPercent } from "./format";
import { heirDeadlock, heirHoldings, isSingleDefaultHeir, normalizeHeirs } from "./heirs";
import type {
  Baseline,
  HeirHolding,
  Holders,
  RiskSignal,
  Scenario,
  SimulationResult,
} from "./types";

/** Coverage below this is critical; below CAUTION is a warning. */
export const COVERAGE_CRITICAL = 2;
export const COVERAGE_CAUTION = 3;
/** Debt / EBITDA above this is critical; at or above CAUTION is a warning. */
export const LEVERAGE_CRITICAL = 5;
export const LEVERAGE_CAUTION = 4;
/** Governance Debt Score at or above CRITICAL is critical; at or above CAUTION is a warning. */
export const GOVERNANCE_CRITICAL = 60;
export const GOVERNANCE_CAUTION = 30;

function sanitizeBaseline(baseline: Baseline): Baseline {
  return {
    revenue: clamp(baseline.revenue, BASELINE_LIMITS.revenue),
    ebitda: clamp(baseline.ebitda, BASELINE_LIMITS.ebitda),
    multiple: clamp(baseline.multiple, BASELINE_LIMITS.multiple),
    existingDebt: clamp(baseline.existingDebt, BASELINE_LIMITS.existingDebt),
    interestRate: clamp(baseline.interestRate, BASELINE_LIMITS.interestRate),
    founderOwnership: clamp(baseline.founderOwnership, BASELINE_LIMITS.founderOwnership),
    heirs: normalizeHeirs(baseline.heirs),
  };
}

function sanitizeScenario(scenario: Scenario, baseline: Baseline): Scenario {
  return {
    leverage: clamp(scenario.leverage, leverageRange(baseline)),
    equityTransfer: clamp(scenario.equityTransfer, SCENARIO_RANGES.equityTransfer),
    multipleShock: clamp(scenario.multipleShock, SCENARIO_RANGES.multipleShock),
    outsideCeo: scenario.outsideCeo === true,
    ceoCost: clamp(scenario.ceoCost, SCENARIO_RANGES.ceoCost),
    ceoUplift: clamp(scenario.ceoUplift, SCENARIO_RANGES.ceoUplift),
  };
}

/** An outside CEO's EBITDA gain: an improvement narrows losses rather than scaling them up. */
export function ceoImprovement(ebitda: number, uplift: number): number {
  return Math.abs(ebitda) * uplift;
}

function splitBy(ownership: Holders, amount: number): Holders {
  return {
    founder: amount * ownership.founder,
    nextGen: amount * ownership.nextGen,
    others: amount * ownership.others,
  };
}

/**
 * Runs one scenario against a baseline company. Pure and deterministic:
 * the same inputs always produce the same outputs, and every output is finite.
 */
export function simulate(
  rawBaseline: Baseline,
  rawScenario: Scenario,
  /** Governance Debt Score (0–100) from `scoreGovernance`; 0 means no governance gaps. */
  governanceScore = 0,
): SimulationResult {
  const baseline = sanitizeBaseline(rawBaseline);
  const scenario = sanitizeScenario(rawScenario, baseline);
  const governance = clamp(governanceScore, { min: 0, max: 100 });

  const adjustedEbitda = scenario.outsideCeo
    ? baseline.ebitda + ceoImprovement(baseline.ebitda, scenario.ceoUplift) - scenario.ceoCost
    : baseline.ebitda;
  const ebitdaMargin = baseline.revenue > 0 ? adjustedEbitda / baseline.revenue : null;

  const effectiveMultiple = baseline.multiple * (1 + scenario.multipleShock);
  const enterpriseValue = Math.max(adjustedEbitda, 0) * effectiveMultiple;

  // Leverage targets are set against today's EBITDA; a loss-making company can't re-lever.
  const totalDebt =
    baseline.ebitda > 0 ? scenario.leverage * baseline.ebitda : baseline.existingDebt;
  const netDistribution = totalDebt - baseline.existingDebt;
  const equityValue = enterpriseValue - totalDebt;

  const ownership: Holders = {
    founder: baseline.founderOwnership * (1 - scenario.equityTransfer),
    nextGen: baseline.founderOwnership * scenario.equityTransfer,
    others: 1 - baseline.founderOwnership,
  };
  const holderEquity = splitBy(ownership, Math.max(equityValue, 0));
  const holderDistribution = splitBy(ownership, netDistribution);
  const heirs = heirHoldings(baseline.heirs!, ownership, holderEquity, holderDistribution);

  const interestExpense = totalDebt * baseline.interestRate;
  const interestCoverage = interestExpense > 0 ? adjustedEbitda / interestExpense : null;
  const debtToEbitda = adjustedEbitda > 0 ? totalDebt / adjustedEbitda : null;

  const governanceDebt = governanceDebtValue(enterpriseValue, governance);

  const signals = assessRisks({
    adjustedEbitda,
    equityValue,
    interestCoverage,
    debtToEbitda,
    ownership,
    heirs,
    governance,
    governanceDebt,
  });

  return {
    adjustedEbitda,
    ebitdaMargin,
    effectiveMultiple,
    enterpriseValue,
    totalDebt,
    netDistribution,
    equityValue,
    ownership,
    holderEquity,
    holderDistribution,
    heirs,
    interestExpense,
    interestCoverage,
    debtToEbitda,
    governanceDebt,
    signals,
  };
}

/** Control and deadlock signals among the next generation. One unnamed heir reads as before heirs existed. */
function heirSignals(ownership: Holders, heirs: HeirHolding[]): RiskSignal[] {
  if (ownership.nextGen <= ownership.founder) return [];
  if (isSingleDefaultHeir(heirs)) {
    return [{
      id: "control-shift",
      severity: "caution",
      title: "Control shifts to the next generation",
      detail: "Heirs now hold more equity than the founder. Confirm governance and voting rights reflect the new balance.",
    }];
  }
  const signals: RiskSignal[] = [];
  const outOwn = heirs.filter((h) => h.ownership > ownership.founder).sort((a, b) => b.ownership - a.ownership);
  signals.push(
    outOwn.length > 0
      ? {
          id: "control-shift",
          severity: "caution",
          title: "Control shifts to the next generation",
          detail: `${outOwn.map((h) => `${h.name} (${formatPercent(h.ownership)})`).join(" and ")} now ${outOwn.length === 1 ? "holds" : "each hold"} more equity than the founder (${formatPercent(ownership.founder)}). Confirm governance and voting rights reflect the new balance.`,
        }
      : {
          id: "heirs-bloc",
          severity: "caution",
          title: "Heirs together out-own the founder",
          detail: `No single heir out-owns the founder, but together the heirs hold ${formatPercent(ownership.nextGen)} against ${formatPercent(ownership.founder)}. Decisions now depend on the heirs agreeing with each other.`,
        },
  );
  const tie = heirDeadlock(heirs);
  if (tie) {
    signals.push({
      id: "heir-deadlock",
      severity: "caution",
      title: "Deadlock risk between heirs",
      detail: `${tie[0].name} and ${tie[1].name} hold equal stakes (${formatPercent(tie[0].ownership)} each) and neither has a majority of the heirs' shares. Without tie-break voting rules, a disagreement between them can stall decisions.`,
    });
  }
  return signals;
}

function assessRisks(r: {
  adjustedEbitda: number;
  equityValue: number;
  interestCoverage: number | null;
  debtToEbitda: number | null;
  ownership: Holders;
  heirs: HeirHolding[];
  governance: number;
  governanceDebt: number;
}): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (r.adjustedEbitda <= 0) {
    signals.push({
      id: "ebitda-negative",
      severity: "critical",
      title: "Operating losses",
      detail: `Adjusted EBITDA is ${formatMoney(r.adjustedEbitda)}; the business cannot support debt or hold its valuation.`,
    });
  }

  if (r.equityValue <= 0) {
    signals.push({
      id: "equity-underwater",
      severity: "critical",
      title: "Equity underwater",
      detail: `Debt exceeds enterprise value by ${formatMoney(-r.equityValue)}; shareholders' equity is wiped out.`,
    });
  }

  if (r.interestCoverage !== null && r.interestCoverage < COVERAGE_CAUTION) {
    const critical = r.interestCoverage < COVERAGE_CRITICAL;
    signals.push({
      id: "coverage",
      severity: critical ? "critical" : "caution",
      title: critical ? "Interest coverage critical" : "Interest coverage thin",
      detail: `EBITDA covers interest ${formatMultiple(r.interestCoverage)}; lenders typically require at least ${formatMultiple(COVERAGE_CAUTION)}.`,
    });
  }

  if (r.debtToEbitda !== null && r.debtToEbitda >= LEVERAGE_CAUTION) {
    const critical = r.debtToEbitda > LEVERAGE_CRITICAL;
    signals.push({
      id: "leverage",
      severity: critical ? "critical" : "caution",
      title: critical ? "Leverage beyond lending norms" : "Leverage elevated",
      detail: `Debt is ${formatMultiple(r.debtToEbitda)} EBITDA; a downturn leaves little room before covenants bite.`,
    });
  }

  signals.push(...heirSignals(r.ownership, r.heirs));

  if (r.governance >= GOVERNANCE_CAUTION) {
    const critical = r.governance >= GOVERNANCE_CRITICAL;
    signals.push({
      id: "governance-debt",
      severity: critical ? "critical" : "caution",
      title: critical ? "Governance debt critical" : "Governance debt building",
      detail: `Governance scores ${Math.round(r.governance)}/100; informal authority, board and voting rules put ${formatMoney(r.governanceDebt)} of Value at Risk.`,
    });
  }

  if (signals.length === 0) {
    signals.push({
      id: "within-guardrails",
      severity: "positive",
      title: "Within guardrails",
      detail: "Valuation, leverage and coverage all sit inside typical lending and governance norms.",
    });
  }

  return signals;
}
