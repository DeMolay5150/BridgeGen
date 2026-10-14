import { COVERAGE_CRITICAL, LEVERAGE_CRITICAL } from "../simulator/engine";
import { formatMoney, formatMultiple, formatPercent } from "../simulator/format";
import type { StatementModel } from "../statements/model";
import type { MonteCarloResult } from "../statements/monte-carlo";
import type { Explanation } from "./types";

const pct = (n: number) => formatPercent(n, 1);

/** How the shareholders' IRR comes out of the three statements. */
export function explainEquityIrr(model: StatementModel): Explanation {
  const last = model.years[model.years.length - 1];
  const dividends = model.years.slice(1).reduce((sum, y) => sum + y.dividends, 0);
  return {
    title: model.equityIrr === null ? "Why is there no equity IRR?" : `Why is the equity IRR ${pct(model.equityIrr)}?`,
    summary: "The return on the equity shareholders hold today, if they make this decision and hold for 10 years.",
    steps: [
      { text: `Year 0 in: today's equity value of ${formatMoney(model.todayEquityValue)}.` },
      {
        text:
          Math.abs(model.day0Distribution) < 0.0005
            ? "Year 0 out: nothing; the decision neither pays out nor calls for capital."
            : model.day0Distribution > 0
              ? `Year 0 out: a ${formatMoney(model.day0Distribution)} dividend recap.`
              : `Year 0 in: ${formatMoney(-model.day0Distribution)} of new capital to pay down debt.`,
      },
      { text: `Years 1–10 out: ${formatMoney(dividends)} of dividends, paid only from cash left after debt service and the cash sweep.` },
      { text: `Year 10 out: equity worth ${formatMoney(Math.max(last.equityValue, 0))} (${formatMoney(last.enterpriseValue)} enterprise value − ${formatMoney(last.debt)} debt).` },
      model.equityIrr === null
        ? { text: "The flows never change sign (or today's equity is nil), so no rate of return exists.", tone: "caution" }
        : { text: `The discount rate that makes those flows net to zero is ${pct(model.equityIrr)} a year.` },
    ],
    note:
      model.wacc === null
        ? undefined
        : `For reference, the post-decision WACC is ${pct(model.wacc)}: a plan earning less than that destroys value for the capital it uses.`,
  };
}

/** What the Monte Carlo simulation did and what it found. */
export function explainMonteCarlo(r: MonteCarloResult, revenueGrowth: number): Explanation {
  const { settings: s } = r;
  return {
    title: `Why is the covenant-breach probability ${pct(r.covenantBreachProbability)}?`,
    summary: `The three-statement model run ${s.paths.toLocaleString("en-US")} times with randomized growth, margins and exit multiple.`,
    steps: [
      { text: `Each year, revenue growth is drawn around ${pct(revenueGrowth)} with a standard deviation of ${pct(s.growthVolatility)}, and EBITDA margin moves by a standard deviation of ${pct(s.marginVolatility)}.` },
      { text: `Each path's exit multiple shifts once, by a standard deviation of ${pct(s.multipleVolatility)}.` },
      {
        text: `A path breaches if, in any year to year ${s.horizon}, coverage falls below ${formatMultiple(COVERAGE_CRITICAL)}, debt exceeds ${formatMultiple(LEVERAGE_CRITICAL)} EBITDA, or EBITDA turns negative. ${pct(r.covenantBreachProbability)} of paths did.`,
        tone: r.covenantBreachProbability >= 0.25 ? "critical" : r.covenantBreachProbability >= 0.1 ? "caution" : "positive",
      },
      { text: `Year-${s.horizon} equity value: ${formatMoney(r.equityValue.p10)} in a bad case (P10), ${formatMoney(r.equityValue.p50)} typical (P50), ${formatMoney(r.equityValue.p90)} in a good case (P90). The base case is ${formatMoney(r.baseCaseEquityValue)}.` },
      ...(r.equityWipeoutProbability > 0
        ? [{ text: `${pct(r.equityWipeoutProbability)} of paths end year ${s.horizon} with equity wiped out.`, tone: "critical" as const }]
        : []),
    ],
    note: `Seed ${s.seed}: the same inputs always give the same distribution, so results are reproducible and nothing is AI-generated.`,
  };
}
