"use client";

import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { SliderRow } from "@/components/slider-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PRIORITY_KEYS,
  PRIORITY_LABELS,
  PRIORITY_RANGE,
  STAKEHOLDER_LABELS,
  contributions,
  scoreScenario,
  type StakeholderId,
} from "@/lib/simulator/alignment";
import { simulate } from "@/lib/simulator/engine";
import { formatMoney, formatMultiple, formatPercent } from "@/lib/simulator/format";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import type { Severity, SimulationResult } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";
import { Questionnaire } from "./questionnaire";

const TONE: Record<Severity, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};

function supportTone(support: number): Severity {
  if (support >= 65) return "positive";
  if (support >= 40) return "caution";
  return "critical";
}

/** Drivers smaller than this many points are noise. */
const MATERIAL_IMPACT = 0.5;

function keyFigures(id: StakeholderId, r: SimulationResult, governanceScore: number) {
  const wealth = (holder: "founder" | "nextGen") => r.holderEquity[holder] + r.holderDistribution[holder];
  switch (id) {
    case "founder":
      return [
        { label: "Ownership retained", value: formatPercent(r.ownership.founder) },
        { label: "Your wealth", value: formatMoney(wealth("founder")) },
      ];
    case "nextGen":
      return [
        { label: "Ownership", value: formatPercent(r.ownership.nextGen) },
        { label: "Your wealth", value: formatMoney(wealth("nextGen")) },
      ];
    case "board":
      return [
        { label: "Governance debt", value: `${Math.round(governanceScore)}/100` },
        { label: "Enterprise value", value: formatMoney(r.enterpriseValue) },
        { label: "Interest coverage", value: formatMultiple(r.interestCoverage) },
      ];
    case "lender":
      return [
        { label: "Interest coverage", value: formatMultiple(r.interestCoverage) },
        { label: "Debt / EBITDA", value: formatMultiple(r.debtToEbitda) },
        { label: "Total debt", value: formatMoney(r.totalDebt) },
      ];
  }
}

export function StakeholderView({ stakeholder }: { stakeholder: StakeholderId }) {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const priorities = useSimulatorStore((s) => s.priorities);
  const setPriorities = useSimulatorStore((s) => s.setPriorities);
  const resetPriorities = useSimulatorStore((s) => s.resetPriorities);

  const result = useMemo(
    () => simulate(baseline, scenario, governanceScore),
    [baseline, scenario, governanceScore],
  );
  const matrix = useMemo(
    () => scoreScenario(baseline, scenario, governanceScore, priorities),
    [baseline, scenario, governanceScore, priorities],
  );

  const label = STAKEHOLDER_LABELS[stakeholder];
  const support = matrix.stakeholders.find((s) => s.id === stakeholder)!.support;
  const drivers = contributions(stakeholder, matrix.subScores, priorities).sort((a, b) => b.impact - a.impact);
  const helping = drivers.filter((d) => d.impact >= MATERIAL_IMPACT).slice(0, 2);
  const hurting = drivers.filter((d) => d.impact <= -MATERIAL_IMPACT).slice(-2).reverse();
  const mine = priorities[stakeholder];
  const totalImportance = PRIORITY_KEYS.reduce((sum, key) => sum + mine[key], 0);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>The {label}&apos;s lens</CardTitle>
            <CardDescription>The simulator&apos;s current scenario, seen from your seat</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Your support</span>
              <span className={cn("font-mono text-4xl tabular-nums", TONE[supportTone(support)])}>
                {Math.round(support)}
                <span className="text-lg text-muted-foreground">/100</span>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              {keyFigures(stakeholder, result, governanceScore).map((f) => (
                <div key={f.label} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="font-mono text-sm text-metric tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-3 text-sm">
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Working for you</span>
                {helping.length ? (
                  helping.map((d) => (
                    <span key={d.key} className="flex justify-between gap-4">
                      {d.label}
                      <span className="font-mono text-positive tabular-nums">+{d.impact.toFixed(1)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Nothing material</span>
                )}
              </div>
              <div className="grid gap-1.5">
                <span className="text-xs text-muted-foreground">Working against you</span>
                {hurting.length ? (
                  hurting.map((d) => (
                    <span key={d.key} className="flex justify-between gap-4">
                      {d.label}
                      <span className="font-mono text-critical tabular-nums">−{Math.abs(d.impact).toFixed(1)}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Nothing material</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What matters to you</CardTitle>
            <CardDescription>Sets your support score everywhere, including the matrix</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {PRIORITY_KEYS.map((key) => (
              <SliderRow
                key={key}
                label={PRIORITY_LABELS[key]}
                hint={`Importance ${mine[key]} of ${PRIORITY_RANGE.max}`}
                value={mine[key]}
                range={PRIORITY_RANGE}
                display={totalImportance > 0 ? formatPercent(mine[key] / totalImportance) : "0%"}
                onChange={(v) => setPriorities(stakeholder, { [key]: Math.round(v) })}
              />
            ))}
            <Button variant="outline" size="sm" className="w-fit" onClick={() => resetPriorities(stakeholder)}>
              <RotateCcw data-icon="inline-start" />
              Restore defaults
            </Button>
          </CardContent>
        </Card>
      </div>

      <Questionnaire stakeholder={stakeholder} />
    </div>
  );
}
