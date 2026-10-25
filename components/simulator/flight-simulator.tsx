"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MonitorPlay, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neutralScenario } from "@/lib/simulator/defaults";
import { simulate } from "@/lib/simulator/engine";
import { formatMoney } from "@/lib/simulator/format";
import { cn } from "@/lib/utils";
import { FinancialModel } from "@/components/statements/financial-model";
import { DeckDialog } from "@/components/deck/deck-dialog";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import { BaselinePanel } from "./baseline-panel";
import { DecisionMatrix } from "./decision-matrix";
import { ResultsPanel } from "./results-panel";
import { ScenarioControls } from "./scenario-controls";

export function FlightSimulator() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const reset = useSimulatorStore((s) => s.reset);
  const result = useMemo(
    () => simulate(baseline, scenario, governanceScore),
    [baseline, scenario, governanceScore],
  );
  const today = useMemo(
    () => simulate(baseline, neutralScenario(baseline), governanceScore),
    [baseline, governanceScore],
  );

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-metric">
            Capital Allocation Flight Simulator
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
            See the consequences before you decide
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/present" />}>
            <MonitorPlay data-icon="inline-start" />
            Present
          </Button>
          <DeckDialog kind="ic" />
          <Button variant="outline" onClick={reset}>
            <RotateCcw data-icon="inline-start" />
            Reset
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <BaselinePanel />
          <ScenarioControls />
          {/* Below lg the results sit under every input; keep the headline in view while levers move. */}
          <div
            aria-live="polite"
            className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card/95 px-4 py-3 text-sm shadow-lg backdrop-blur lg:hidden"
          >
            <span>
              Equity value{" "}
              <span className={cn("font-mono tabular-nums", result.equityValue <= 0 ? "text-critical" : "text-metric")}>
                {formatMoney(result.equityValue)}
              </span>
            </span>
            <a href="#results" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              See all results
            </a>
          </div>
        </div>
        <div id="results" className="scroll-mt-6 lg:sticky lg:top-6">
          <ResultsPanel result={result} today={today} baseline={baseline} scenario={scenario} />
        </div>
      </div>

      <DecisionMatrix />

      <FinancialModel />
    </div>
  );
}
