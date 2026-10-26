"use client";

import { useDeferredValue, useMemo } from "react";
import Link from "next/link";
import { Bar, BarChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ExplainButton } from "@/components/explain/explain-button";
import { SliderRow } from "@/components/slider-row";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { explainEquityIrr, explainMonteCarlo } from "@/lib/explain/statements";
import { ASSUMPTION_RANGES } from "@/lib/projection/model";
import { formatMoney, formatPercent, formatSignedPercent } from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";
import type { Severity } from "@/lib/simulator/types";
import {
  STATEMENT_RANGES,
  buildStatements,
  statementAssumptions,
  type OperatingAssumptions,
} from "@/lib/statements/model";
import { runMonteCarlo } from "@/lib/statements/monte-carlo";
import { cn } from "@/lib/utils";
import { StatementTable, type StatementLine } from "./statement-table";

const INCOME: StatementLine[] = [
  { label: "Revenue", value: (y) => y.revenue, strong: true },
  { label: "EBITDA", value: (y) => y.ebitda },
  { label: "Depreciation", value: (y) => -y.depreciation },
  { label: "EBIT", value: (y) => y.ebit },
  { label: "Interest", value: (y) => -y.interest },
  { label: "Taxes", value: (y) => -y.taxes },
  { label: "Net income", value: (y) => y.netIncome, strong: true },
];

const CASH_FLOW: StatementLine[] = [
  { label: "Net income", value: (y) => y.netIncome },
  { label: "Add back depreciation", value: (y) => y.depreciation },
  { label: "Change in working capital", value: (y) => -y.changeInWorkingCapital },
  { label: "Operating cash flow", value: (y) => y.operatingCashFlow, strong: true },
  { label: "Capital expenditure", value: (y) => -y.capex },
  { label: "Free cash flow", value: (y) => y.freeCashFlow, strong: true },
  { label: "Scheduled debt repayment", value: (y) => -y.mandatoryRepayment },
  { label: "Cash sweep", value: (y) => -y.cashSweep },
  { label: "Revolver draw", value: (y) => y.revolverDraw, flag: true },
  { label: "Dividends", value: (y) => -y.dividends },
];

const BALANCE_SHEET: StatementLine[] = [
  { label: "Cash", value: (y) => y.cash },
  { label: "Net working capital", value: (y) => y.workingCapital },
  { label: "Net PP&E", value: (y) => y.fixedAssets },
  { label: "Total assets", value: (y) => y.totalAssets, strong: true },
  { label: "Debt", value: (y) => y.debt },
  { label: "Book equity", value: (y) => y.equity },
  { label: "Debt + equity", value: (y) => y.debt + y.equity, strong: true },
  { label: "Balance check", value: (y) => y.balanceCheck, flag: true },
];

const CREDIT: StatementLine[] = [
  { label: "Enterprise value", value: (y) => y.enterpriseValue },
  { label: "Equity value", value: (y) => y.equityValue, strong: true },
  { label: "Interest coverage", value: (y) => y.interestCoverage, format: "multiple" },
  { label: "Debt / EBITDA", value: (y) => y.debtToEbitda, format: "multiple" },
];

type AssumptionKey = keyof OperatingAssumptions;
const ASSUMPTION_CONTROLS: { key: AssumptionKey; label: string; hint: string; display: (v: number) => string }[] = [
  { key: "taxRate", label: "Tax rate", hint: "On positive pre-tax profit", display: (v) => formatPercent(v) },
  { key: "capex", label: "Capex", hint: "% of revenue", display: (v) => formatPercent(v, 1) },
  { key: "depreciation", label: "Depreciation", hint: "% of revenue", display: (v) => formatPercent(v, 1) },
  { key: "workingCapital", label: "Working capital", hint: "Held as % of revenue", display: (v) => formatPercent(v) },
  { key: "debtTermYears", label: "Debt term", hint: "Straight-line repayment of day-0 debt", display: (v) => `${v} yrs` },
  { key: "costOfEquity", label: "Cost of equity", hint: "For WACC", display: (v) => formatPercent(v, 1) },
];

const toneText: Record<Severity, string> = { positive: "text-positive", caution: "text-caution", critical: "text-critical" };
const breachTone = (p: number): Severity => (p >= 0.25 ? "critical" : p >= 0.1 ? "caution" : "positive");

const histogramConfig = { count: { label: "Paths", color: "var(--metric)" } } satisfies ChartConfig;

/**
 * Linked three-statement model and Monte Carlo stress view of the live
 * scenario. Revenue growth is Fork the Future's growth assumption, so both
 * modules project the same EBITDA.
 */
export function FinancialModel() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const fork = useSimulatorStore((s) => s.fork);
  const setFork = useSimulatorStore((s) => s.setFork);
  const operating = fork.statements;

  const assumptions = useMemo(() => statementAssumptions(fork), [fork]);
  const model = useMemo(() => buildStatements(baseline, scenario, assumptions), [baseline, scenario, assumptions]);

  // A thousand paths per change: let slider drags stay smooth while it catches up.
  // Each input is deferred separately so unchanged references keep the memo warm.
  const deferredBaseline = useDeferredValue(baseline);
  const deferredScenario = useDeferredValue(scenario);
  const deferredAssumptions = useDeferredValue(assumptions);
  const simulation = useMemo(
    () => runMonteCarlo(deferredBaseline, deferredScenario, deferredAssumptions),
    [deferredBaseline, deferredScenario, deferredAssumptions],
  );
  const stale = deferredAssumptions !== assumptions || deferredScenario !== scenario || deferredBaseline !== baseline;
  const tone = breachTone(simulation.covenantBreachProbability);
  const horizon = simulation.settings.horizon;
  const bars = simulation.histogram.map((b) => ({ ...b, mid: (b.from + b.to) / 2 }));

  return (
    <section className="grid gap-6" aria-labelledby="financial-model-heading">
      <div className="grid gap-1">
        <h2 id="financial-model-heading" className="font-heading text-lg font-semibold">
          Three-statement model
        </h2>
        <p className="text-sm text-muted-foreground">
          Income statement, cash flow and balance sheet for the scenario above, linked and balanced every year.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardContent>
            <Tabs defaultValue="income" className="gap-4">
              <div className="overflow-x-auto overflow-y-hidden">
                <TabsList>
                  <TabsTrigger value="income">Income statement</TabsTrigger>
                  <TabsTrigger value="cash">Cash flow</TabsTrigger>
                  <TabsTrigger value="balance">Balance sheet</TabsTrigger>
                  <TabsTrigger value="credit">Value &amp; credit</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="income">
                <StatementTable title="Income statement" lines={INCOME} years={model.years.slice(1)} />
              </TabsContent>
              <TabsContent value="cash">
                <StatementTable title="Cash flow statement" lines={CASH_FLOW} years={model.years.slice(1)} />
              </TabsContent>
              <TabsContent value="balance">
                <StatementTable title="Balance sheet" lines={BALANCE_SHEET} years={model.years} />
              </TabsContent>
              <TabsContent value="credit">
                <StatementTable title="Value and credit" lines={CREDIT} years={model.years} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating assumptions</CardTitle>
            <CardDescription>
              These inputs, growth included, also drive{" "}
              <Link href="/fork" className="text-foreground underline underline-offset-4">
                Fork the Future
              </Link>
              , and they&apos;re saved with the company.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <SliderRow
              label="Revenue growth"
              hint="Margins held, so EBITDA grows alike"
              value={fork.assumptions.ebitdaGrowth}
              range={ASSUMPTION_RANGES.ebitdaGrowth}
              display={`${formatSignedPercent(fork.assumptions.ebitdaGrowth)}/yr`}
              onChange={(ebitdaGrowth) => setFork({ assumptions: { ...fork.assumptions, ebitdaGrowth } })}
            />
            {ASSUMPTION_CONTROLS.map((c) => (
              <SliderRow
                key={c.key}
                label={c.label}
                hint={c.hint}
                value={operating[c.key]}
                range={STATEMENT_RANGES[c.key]}
                display={c.display(operating[c.key])}
                onChange={(value) => setFork({ statements: { ...operating, [c.key]: value } })}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="grid gap-1">
            <div className="-my-1 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Equity IRR, 10 years</span>
              <ExplainButton subject="the equity IRR" explain={() => explainEquityIrr(model)} />
            </div>
            <span className="font-mono text-2xl text-metric tabular-nums">
              {model.equityIrr === null ? "n/a" : formatPercent(model.equityIrr, 1)}
            </span>
            <span className="text-xs text-muted-foreground">
              WACC {model.wacc === null ? "n/a" : formatPercent(model.wacc, 1)}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <div className="-my-1 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Covenant breach probability</span>
              <ExplainButton
                subject="the covenant breach probability"
                explain={() => explainMonteCarlo(simulation, deferredAssumptions.revenueGrowth)}
              />
            </div>
            <span className={cn("font-mono text-2xl tabular-nums transition-opacity", toneText[tone], stale && "opacity-60")}>
              {formatPercent(simulation.covenantBreachProbability, 1)}
            </span>
            <span className="text-xs text-muted-foreground">
              Of {simulation.settings.paths.toLocaleString("en-US")} paths, by year {horizon}
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-1">
            <span className="text-xs text-muted-foreground">Equity value, year {horizon} (P10 · P50 · P90)</span>
            <span className={cn("font-mono text-lg tabular-nums transition-opacity", stale && "opacity-60")}>
              <span className="text-critical">{formatMoney(simulation.equityValue.p10)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-metric">{formatMoney(simulation.equityValue.p50)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="text-positive">{formatMoney(simulation.equityValue.p90)}</span>
            </span>
            <span className="text-xs text-muted-foreground">Base case {formatMoney(simulation.baseCaseEquityValue)}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribution of outcomes</CardTitle>
          <CardDescription>
            Year-{horizon} equity value across {simulation.settings.paths.toLocaleString("en-US")} simulated paths. The line
            marks the base case.
          </CardDescription>
          <CardAction>
            <ExplainButton
              subject="the Monte Carlo simulation"
              explain={() => explainMonteCarlo(simulation, deferredAssumptions.revenueGrowth)}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={histogramConfig}
            className={cn("aspect-auto h-56 w-full transition-opacity", stale && "opacity-60")}
            role="img"
            aria-label={`Year-${horizon} equity value: P10 ${formatMoney(simulation.equityValue.p10)}, median ${formatMoney(simulation.equityValue.p50)}, P90 ${formatMoney(simulation.equityValue.p90)}.`}
          >
            <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 8, left: 0 }} barCategoryGap={1}>
              <XAxis
                dataKey="mid"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v: number) => formatMoney(v)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <ReferenceLine x={simulation.baseCaseEquityValue} stroke="var(--caution)" strokeDasharray="3 3" />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={({ active, payload }) => {
                  const b = active ? (payload?.[0]?.payload as (typeof bars)[number] | undefined) : undefined;
                  if (!b) return null;
                  return (
                    <div className="grid gap-0.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
                      <span className="font-mono text-foreground tabular-nums">
                        {formatMoney(b.from)} to {formatMoney(b.to)}
                      </span>
                      <span className="text-muted-foreground">
                        {b.count} paths ({formatPercent(b.count / simulation.settings.paths, 1)})
                      </span>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </section>
  );
}
