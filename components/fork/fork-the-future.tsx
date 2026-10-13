"use client";

import { SliderRow } from "@/components/slider-row";
import { ExplainButton } from "@/components/explain/explain-button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { explainForkLead } from "@/lib/explain/fork";
import { resolveBranch } from "@/lib/projection/branches";
import { ASSUMPTION_RANGES, HORIZONS, project } from "@/lib/projection/model";
import { formatMoney, formatPercent, formatSignedPercent } from "@/lib/simulator/format";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import { BranchCard } from "./branch-card";
import { HorizonTable } from "./horizon-table";
import { ProjectionChart } from "./projection-chart";

/** Leads under $50K are treated as a tie. */
const TIE = 0.05;

export function ForkTheFuture() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const fork = useSimulatorStore((s) => s.fork);
  const setFork = useSimulatorStore((s) => s.setFork);

  const context = { baseline, scenario, governanceScore };
  const branchA = resolveBranch(fork.a, context);
  const branchB = resolveBranch(fork.b, context);

  // Eleven years of O(1) arithmetic per branch: cheap enough to recompute every render.
  const a = project(baseline, branchA.scenario, branchA.governanceScore, fork.assumptions);
  const b = project(baseline, branchB.scenario, branchB.governanceScore, fork.assumptions);

  const identical = a.every((point, i) => Math.abs(point.shareholderValue - b[i].shareholderValue) < 1e-9);
  const labels = { a: branchA.label, b: branchB.label };

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Fork the Future</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Two decisions, ten years, side by side
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <BranchCard
          name="Branch A"
          swatch="bg-chart-5"
          spec={fork.a}
          resolved={branchA}
          onChange={(spec) => setFork({ a: spec })}
        />
        <BranchCard
          name="Branch B"
          swatch="bg-metric"
          spec={fork.b}
          resolved={branchB}
          onChange={(spec) => setFork({ b: spec })}
        />
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Shared by both branches</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <SliderRow
              label="EBITDA growth"
              hint="Annual growth in operating earnings"
              value={fork.assumptions.ebitdaGrowth}
              range={ASSUMPTION_RANGES.ebitdaGrowth}
              display={`${formatSignedPercent(fork.assumptions.ebitdaGrowth)}/yr`}
              onChange={(ebitdaGrowth) => setFork({ assumptions: { ...fork.assumptions, ebitdaGrowth } })}
            />
            <SliderRow
              label="Cash conversion"
              hint="EBITDA left after taxes, capex and working capital"
              value={fork.assumptions.cashConversion}
              range={ASSUMPTION_RANGES.cashConversion}
              display={formatPercent(fork.assumptions.cashConversion)}
              onChange={(cashConversion) => setFork({ assumptions: { ...fork.assumptions, cashConversion } })}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shareholder value over time</CardTitle>
          <CardDescription>
            Equity, minus expected governance losses, plus all cash paid out to date.
          </CardDescription>
          {!identical && (
            <CardAction>
              <ExplainButton subject="the 10-year gap" explain={() => explainForkLead(a, b, labels, 10)}>
                Explain the 10-year gap
              </ExplainButton>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-6">
          {identical ? (
            <p className="rounded-lg bg-caution/10 px-3 py-2 text-sm text-caution">
              Both branches are identical. Pick a different starting point for one branch, or fix
              governance in one, to see the futures diverge.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Who's ahead at each horizon">
              {HORIZONS.map((h) => {
                const lead = b[h].shareholderValue - a[h].shareholderValue;
                const tie = Math.abs(lead) < TIE;
                return (
                  <li key={h} className="grid gap-1 rounded-lg border border-border px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      {h} {h === 1 ? "year" : "years"}
                    </span>
                    <span className="text-sm font-medium">
                      {tie ? "Even" : lead > 0 ? "B ahead" : "A ahead"}
                    </span>
                    {!tie && (
                      <span className={lead > 0 ? "font-mono text-sm text-metric tabular-nums" : "font-mono text-sm text-foreground tabular-nums"}>
                        +{formatMoney(Math.abs(lead))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <ProjectionChart a={a} b={b} labels={labels} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horizon detail</CardTitle>
        </CardHeader>
        <CardContent>
          <HorizonTable a={a} b={b} labels={labels} />
        </CardContent>
      </Card>
    </div>
  );
}
