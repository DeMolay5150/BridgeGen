"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { neutralScenario } from "@/lib/simulator/defaults";
import { simulate } from "@/lib/simulator/engine";
import { FinancialModel } from "@/components/statements/financial-model";
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
        <Button variant="outline" onClick={reset}>
          <RotateCcw data-icon="inline-start" />
          Reset
        </Button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <BaselinePanel />
          <ScenarioControls />
        </div>
        <div className="lg:sticky lg:top-6">
          <ResultsPanel result={result} today={today} baseline={baseline} scenario={scenario} />
        </div>
      </div>

      <DecisionMatrix />

      <FinancialModel />
    </div>
  );
}
