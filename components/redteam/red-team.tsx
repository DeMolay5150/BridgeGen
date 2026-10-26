"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DeckDialog } from "@/components/deck/deck-dialog";
import { BriefCard } from "@/components/narrative/brief-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { redTeamBrief } from "@/lib/narrative/redteam";
import { breakingPoints } from "@/lib/redteam/breaking";
import { SHOCKS, runShock } from "@/lib/redteam/shocks";
import type { BreakingPoint } from "@/lib/redteam/types";
import { BASELINE_LIMITS, clamp, neutralScenario } from "@/lib/simulator/defaults";
import { describeScenario } from "@/lib/simulator/describe";
import { simulate } from "@/lib/simulator/engine";
import { formatPercent } from "@/lib/simulator/format";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { LiquidityCard } from "./liquidity-card";
import { ShockCard } from "./shock-card";

const TONE: Record<Severity, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};

/** Two breaking points within this distance are treated as equally fragile. */
const SAME_FRAGILITY = 0.005;

function thresholdLabel(threshold: number | null): string {
  if (threshold === null) return "Can't break";
  if (threshold === 0) return "Already broken";
  return `${formatPercent(threshold, 1)} fall`;
}

const closest = (points: BreakingPoint[]) => points[0]?.threshold ?? null;

export function RedTeam() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceAnswers = useSimulatorStore((s) => s.governance);
  const governanceScore = useSimulatorStore(selectGovernanceScore);

  const rate = clamp(baseline.interestRate, BASELINE_LIMITS.interestRate);
  const yours = useMemo(() => breakingPoints(simulate(baseline, scenario), rate), [baseline, scenario, rate]);
  const today = useMemo(
    () => breakingPoints(simulate(baseline, neutralScenario(baseline)), rate),
    [baseline, rate],
  );
  const shocks = useMemo(
    () => SHOCKS.map((s) => runShock(baseline, scenario, governanceAnswers, s.id)),
    [baseline, scenario, governanceAnswers],
  );
  const brief = useMemo(() => redTeamBrief(shocks, yours, today), [shocks, yours, today]);

  const todayById = Object.fromEntries(today.map((p) => [p.id, p.threshold]));
  const yourClosest = closest(yours) ?? Infinity;
  const todayClosest = closest(today) ?? Infinity;
  const fragility =
    Math.abs(yourClosest - todayClosest) < SAME_FRAGILITY || yourClosest === todayClosest
      ? { text: "Your decision leaves the company exactly as fragile as today.", tone: "text-muted-foreground" }
      : yourClosest < todayClosest
        ? { text: "Your decision makes the company more fragile than today.", tone: "text-critical" }
        : { text: "Your decision makes the company more resilient than today.", tone: "text-positive" };

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-critical">Red Team Mode</p>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Break the plan before reality does
            </h1>
          </div>
          <DeckDialog kind="redTeam" />
        </div>
        <p className="text-sm text-muted-foreground">
          Attacking your scenario: <span className="font-mono text-xs text-foreground">{describeScenario(scenario, governanceScore)}</span>{" "}
          <Link href="/simulator" className="underline underline-offset-4">
            Change in simulator
          </Link>
        </p>
      </header>

      <BriefCard brief={brief} description="Investment-committee view of the stress results below." />

      <Card>
        <CardHeader>
          <CardTitle>Breaking points</CardTitle>
          <CardDescription>
            How far earnings or the valuation multiple can fall before each limit breaks. Closest
            first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className={cn("text-sm font-medium", fragility.tone)}>{fragility.text}</p>
          <div tabIndex={0} role="region" className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label="Breaking points, scrolls sideways">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-normal">Limit</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Driver</th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">Your scenario</th>
                  <th scope="col" className="py-2 text-right font-normal">Today</th>
                </tr>
              </thead>
              <tbody>
                {yours.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">{p.limit}</th>
                    <td className="py-2 pr-4 text-muted-foreground">{p.driver} falls</td>
                    <td className={cn("py-2 pr-4 text-right font-mono tabular-nums", TONE[p.severity])}>
                      {thresholdLabel(p.threshold)}
                      {p.severity !== "positive" && (
                        <span className="ml-1.5 font-sans text-xs">{p.severity === "critical" ? "critical" : "caution"}</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-muted-foreground tabular-nums">
                      {thresholdLabel(todayById[p.id] ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <LiquidityCard />

      <section className="grid gap-4" aria-labelledby="shocks-heading">
        <h2 id="shocks-heading" className="font-heading text-lg font-semibold">
          Stress scenarios
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {shocks.map((shock) => (
            <ShockCard key={shock.id} shock={shock} />
          ))}
        </div>
      </section>
    </div>
  );
}
