import { BASELINE_LIMITS, SCENARIO_RANGES, clamp, neutralScenario } from "../simulator/defaults";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL, simulate } from "../simulator/engine";
import { formatMoney, formatMultiple, formatPercent, formatSignedPercent } from "../simulator/format";
import type { Baseline, Holders, Scenario, SimulationResult } from "../simulator/types";
import { attribute } from "./attribution";
import type { Explanation, ExplanationStep } from "./types";

const MONEY = { format: formatMoney, materiality: 0.05 };

const HOLDER_LABELS: Record<keyof Holders, string> = {
  founder: "Founder",
  nextGen: "Next gen",
  others: "Other shareholders",
};

/** Rates like 8% show whole; 7.5% keeps its decimal. */
const formatRate = (rate: number) =>
  formatPercent(rate, Number.isInteger(Math.round(rate * 10_000) / 100) ? 0 : 1);

/** "Founder 80% = $72.0M · Other shareholders 20% = $18.0M", skipping empty holdings. */
function holderSplit(ownership: Holders, amounts: Holders, withShare = true): string {
  return (Object.keys(HOLDER_LABELS) as (keyof Holders)[])
    .filter((h) => ownership[h] > 1e-9)
    .map((h) =>
      withShare
        ? `${HOLDER_LABELS[h]} ${formatPercent(ownership[h])} = ${formatMoney(amounts[h])}`
        : `${HOLDER_LABELS[h]} ${formatMoney(Math.abs(amounts[h]))}`,
    )
    .join(" · ");
}

function debtStep(baseline: Baseline, scenario: Scenario, r: SimulationResult): ExplanationStep {
  const ebitda = clamp(baseline.ebitda, BASELINE_LIMITS.ebitda);
  return ebitda > 0
    ? { text: `Debt is ${formatMultiple(clamp(scenario.leverage, SCENARIO_RANGES.leverage))} × ${formatMoney(ebitda)} EBITDA = ${formatMoney(r.totalDebt)}.` }
    : { text: `Debt stays at ${formatMoney(r.totalDebt)}: a loss-making company can't borrow more.`, tone: "caution" };
}

export function explainEnterpriseValue(baseline: Baseline, scenario: Scenario): Explanation {
  const r = simulate(baseline, scenario);
  const ebitda = clamp(baseline.ebitda, BASELINE_LIMITS.ebitda);
  const multiple = clamp(baseline.multiple, BASELINE_LIMITS.multiple);
  const shock = clamp(scenario.multipleShock, SCENARIO_RANGES.multipleShock);
  const steps: ExplanationStep[] = [{ text: `EBITDA today is ${formatMoney(ebitda)}.` }];

  if (scenario.outsideCeo) {
    const uplift = clamp(scenario.ceoUplift, SCENARIO_RANGES.ceoUplift);
    const cost = clamp(scenario.ceoCost, SCENARIO_RANGES.ceoCost);
    steps.push({
      text: `An outside CEO lifts EBITDA ${formatPercent(uplift)} but costs ${formatMoney(cost)} a year, so adjusted EBITDA is ${formatMoney(r.adjustedEbitda)}.`,
    });
  }
  steps.push({
    text:
      Math.abs(shock) > 1e-9
        ? `Businesses like this trade at ${formatMultiple(multiple)} EBITDA; a ${formatSignedPercent(shock)} market shift makes it ${formatMultiple(r.effectiveMultiple)}.`
        : `Businesses like this trade at ${formatMultiple(r.effectiveMultiple)} EBITDA.`,
  });
  steps.push(
    r.adjustedEbitda > 0
      ? { text: `${formatMoney(r.adjustedEbitda)} × ${formatMultiple(r.effectiveMultiple)} = ${formatMoney(r.enterpriseValue)} enterprise value.` }
      : { text: "With no positive EBITDA, the business has no earnings value: $0.0M.", tone: "critical" },
  );

  return {
    title: `Why is enterprise value ${formatMoney(r.enterpriseValue)}?`,
    summary: "Enterprise value is what a buyer would pay for the whole business: adjusted EBITDA × the valuation multiple.",
    steps,
    drivers: attribute(baseline, scenario, (s) => simulate(baseline, s).enterpriseValue, MONEY),
    note: "Enterprise value ignores debt. Equity value shows what the owners keep.",
  };
}

export function explainEquity(baseline: Baseline, scenario: Scenario): Explanation {
  const r = simulate(baseline, scenario);
  const steps: ExplanationStep[] = [
    { text: `Enterprise value is ${formatMoney(r.enterpriseValue)}.` },
    debtStep(baseline, scenario, r),
  ];
  if (r.equityValue > 0) {
    steps.push({ text: `${formatMoney(r.enterpriseValue)} − ${formatMoney(r.totalDebt)} = ${formatMoney(r.equityValue)} equity.` });
    steps.push({ text: holderSplit(r.ownership, r.holderEquity) });
  } else {
    steps.push({
      text: `Debt exceeds enterprise value by ${formatMoney(-r.equityValue)}: equity is underwater and owners would receive nothing in a sale.`,
      tone: "critical",
    });
  }
  return {
    title: `Why is equity value ${formatMoney(r.equityValue)}?`,
    summary: "Equity is what the owners keep after lenders are repaid: enterprise value minus debt.",
    steps,
    drivers: attribute(baseline, scenario, (s) => simulate(baseline, s).equityValue, MONEY),
  };
}

export function explainDistribution(baseline: Baseline, scenario: Scenario): Explanation {
  const r = simulate(baseline, scenario);
  const today = simulate(baseline, neutralScenario(baseline));
  const existing = r.totalDebt - r.netDistribution;
  const amount = Math.abs(r.netDistribution);
  const drivers = attribute(baseline, scenario, (s) => simulate(baseline, s).netDistribution, MONEY);

  if (amount < 0.0005) {
    return {
      title: "Why does no cash change hands?",
      summary: "Borrowing is unchanged, so nothing is paid out and nothing has to be put in.",
      steps: [{ text: `Debt stays at ${formatMoney(today.totalDebt)}, exactly where it is today.` }],
      drivers,
    };
  }

  const recap = r.netDistribution > 0;
  return {
    title: recap
      ? `Why are shareholders paid ${formatMoney(amount)}?`
      : `Why must shareholders put in ${formatMoney(amount)}?`,
    summary: recap
      ? "Borrowing more than the company owes today frees cash that is paid out as a dividend recap."
      : "Borrowing less than the company owes today means shareholders fund the repayment.",
    steps: [
      { text: `Debt ${recap ? "rises" : "falls"} from ${formatMoney(existing)} today to ${formatMoney(r.totalDebt)}.` },
      recap
        ? { text: `The extra ${formatMoney(amount)} is paid out to shareholders as a dividend recap.` }
        : { text: `Shareholders put in ${formatMoney(amount)} to repay it.`, tone: "caution" },
      { text: holderSplit(r.ownership, r.holderDistribution, false) },
    ],
    drivers,
    note: recap
      ? `Equity value falls by the same ${formatMoney(amount)}, so total shareholder value is unchanged today. The cost is interest, which Fork the Future shows compounding.`
      : `Equity value rises by the same ${formatMoney(amount)}; lower debt cuts interest and adds resilience.`,
  };
}

export function explainCoverage(baseline: Baseline, scenario: Scenario): Explanation {
  const r = simulate(baseline, scenario);
  if (r.interestCoverage === null) {
    return {
      title: "Why is interest coverage n/a?",
      summary: "Interest coverage measures how many times earnings pay the interest bill.",
      steps: [{ text: "There is no debt, so there is no interest to cover.", tone: "positive" }],
    };
  }
  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const cov = r.interestCoverage;
  const verdict: ExplanationStep =
    cov < COVERAGE_CRITICAL
      ? { text: "This is below the critical line: expect covenant breaches and lender pressure.", tone: "critical" }
      : cov < COVERAGE_CAUTION
        ? { text: "This is below what lenders typically want.", tone: "caution" }
        : { text: "Comfortably within lender norms.", tone: "positive" };

  return {
    title: `Why is interest coverage ${formatMultiple(cov)}?`,
    summary: "Interest coverage measures how many times earnings pay the interest bill.",
    steps: [
      { text: `Interest is ${formatMoney(r.totalDebt)} × ${formatRate(rate)} = ${formatMoney(r.interestExpense)} a year.` },
      { text: `${formatMoney(r.adjustedEbitda)} EBITDA ÷ ${formatMoney(r.interestExpense)} = ${formatMultiple(cov)} coverage.` },
      { text: `Lenders typically want at least ${formatMultiple(COVERAGE_CAUTION)}; below ${formatMultiple(COVERAGE_CRITICAL)} is critical.` },
      verdict,
    ],
    drivers: attribute(baseline, scenario, (s) => simulate(baseline, s).interestCoverage, {
      format: formatMultiple,
      materiality: 0.05,
    }),
  };
}
