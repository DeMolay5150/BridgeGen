"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { ExplainButton } from "@/components/explain/explain-button";
import { Button } from "@/components/ui/button";
import { explainAlignment, explainEconomics } from "@/lib/explain/matrix";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { scoreScenario, type MatrixScore } from "@/lib/simulator/alignment";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import { STRATEGIES, strategyScenario, type Strategy } from "@/lib/simulator/strategies";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

const MIDPOINT = 50;

interface Point {
  id: string;
  name: string;
  economics: number;
  alignment: number;
}

const chartConfig = {
  economics: { label: "Economics" },
  alignment: { label: "Alignment" },
} satisfies ChartConfig;

const QUADRANTS: { name: string; severity: Severity; x: [number, number]; y: [number, number]; position: "insideTopRight" | "insideBottomRight" | "insideTopLeft" | "insideBottomLeft" }[] = [
  { name: "Aligned value creation", severity: "positive", x: [MIDPOINT, 100], y: [MIDPOINT, 100], position: "insideTopRight" },
  { name: "Value at odds", severity: "caution", x: [MIDPOINT, 100], y: [0, MIDPOINT], position: "insideBottomRight" },
  { name: "Harmony, weak economics", severity: "caution", x: [0, MIDPOINT], y: [MIDPOINT, 100], position: "insideTopLeft" },
  { name: "Danger zone", severity: "critical", x: [0, MIDPOINT], y: [0, MIDPOINT], position: "insideBottomLeft" },
];

const SEVERITY_VAR: Record<Severity, string> = {
  positive: "var(--positive)",
  caution: "var(--caution)",
  critical: "var(--critical)",
};

const SEVERITY_TEXT: Record<Severity, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};

const SEVERITY_BAR: Record<Severity, string> = {
  positive: "bg-positive",
  caution: "bg-caution",
  critical: "bg-critical",
};

function quadrantOf({ economics, alignment }: Pick<Point, "economics" | "alignment">) {
  const right = economics >= MIDPOINT;
  const top = alignment >= MIDPOINT;
  return QUADRANTS.find(
    (q) => (q.x[0] === MIDPOINT) === right && (q.y[0] === MIDPOINT) === top,
  )!;
}

function supportSeverity(support: number): Severity {
  if (support >= 65) return "positive";
  if (support >= 40) return "caution";
  return "critical";
}

const round = (n: number) => Math.round(n);

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <span className="font-medium text-foreground">{point.name}</span>
      <span className="font-mono text-muted-foreground tabular-nums">
        Economics {round(point.economics)} · Alignment {round(point.alignment)}
      </span>
    </div>
  );
}

export function DecisionMatrix() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const priorities = useSimulatorStore((s) => s.priorities);
  const setScenario = useSimulatorStore((s) => s.setScenario);

  const current: MatrixScore = useMemo(
    () => scoreScenario(baseline, scenario, governanceScore, priorities),
    [baseline, scenario, governanceScore, priorities],
  );
  const strategies = useMemo(
    () =>
      STRATEGIES.map((strategy) => ({
        strategy,
        score: scoreScenario(baseline, strategyScenario(baseline, strategy), governanceScore, priorities),
      })),
    [baseline, governanceScore, priorities],
  );

  const load = (strategy: Strategy) => setScenario(strategyScenario(baseline, strategy));

  const toPoint = ({ strategy, score }: (typeof strategies)[number]): Point => ({
    id: strategy.id,
    name: strategy.name,
    economics: score.economics,
    alignment: score.alignment,
  });
  const todayEntry = strategies.find((s) => s.strategy.id === "today")!;
  const presetEntries = strategies.filter((s) => s.strategy.id !== "today");
  const presetPoints = presetEntries.map(toPoint);
  const todayPoints = [toPoint(todayEntry)];
  const currentPoints: Point[] = [
    { id: "current", name: "Your scenario", economics: current.economics, alignment: current.alignment },
  ];
  const quadrant = quadrantOf(current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Economics vs. Alignment</CardTitle>
        <CardDescription>
          Financial performance against stakeholder consensus. Strong economics with a divided
          family is a deal that breaks later.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="grid gap-4">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-80 w-full"
            role="img"
            aria-label={`Matrix: your scenario scores economics ${round(current.economics)} and alignment ${round(current.alignment)}, in the ${quadrant.name} quadrant.`}
          >
            <ScatterChart margin={{ top: 12, right: 12, bottom: 20, left: 0 }}>
              {QUADRANTS.map((q) => (
                <ReferenceArea
                  key={q.name}
                  x1={q.x[0]}
                  x2={q.x[1]}
                  y1={q.y[0]}
                  y2={q.y[1]}
                  fill={SEVERITY_VAR[q.severity]}
                  fillOpacity={0.04}
                  stroke="none"
                  label={{ value: q.name, position: q.position, fill: SEVERITY_VAR[q.severity], fontSize: 11, opacity: 0.8 }}
                />
              ))}
              <CartesianGrid strokeDasharray="2 4" />
              <ReferenceLine x={MIDPOINT} stroke="var(--border)" />
              <ReferenceLine y={MIDPOINT} stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="economics"
                name="Economics"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickLine={false}
                axisLine={false}
                label={{ value: "Economics →", position: "insideBottom", offset: -12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="number"
                dataKey="alignment"
                name="Alignment"
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickLine={false}
                axisLine={false}
                width={44}
                label={{ value: "Alignment →", angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip cursor={false} content={<MatrixTooltip />} />
              <Scatter
                data={presetPoints}
                isAnimationActive={false}
                shape={({ cx, cy, index }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="var(--chart-5)"
                    fillOpacity={0.85}
                    className="cursor-pointer"
                    onClick={() => load(presetEntries[index].strategy)}
                  />
                )}
              />
              <Scatter
                data={todayPoints}
                isAnimationActive={false}
                shape={({ cx, cy }) => (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => load(todayEntry.strategy)}
                  />
                )}
              />
              {/* Rendered last so the live scenario always sits on top. */}
              <Scatter
                data={currentPoints}
                isAnimationActive={false}
                shape={({ cx, cy }) => (
                  <g>
                    <circle cx={cx} cy={cy} r={14} fill="var(--metric)" fillOpacity={0.15} />
                    <circle cx={cx} cy={cy} r={7} fill="var(--metric)" stroke="var(--background)" strokeWidth={2} />
                  </g>
                )}
              />
            </ScatterChart>
          </ChartContainer>

          <div className="grid gap-2">
            <span className="text-xs text-muted-foreground">Load a strategy</span>
            <div className="flex flex-wrap gap-2">
              {strategies.map(({ strategy, score }) => (
                <Button
                  key={strategy.id}
                  variant="outline"
                  size="sm"
                  title={strategy.description}
                  onClick={() => load(strategy)}
                >
                  {strategy.name}
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {round(score.economics)}/{round(score.alignment)}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1">
              <span className="-my-1 flex items-center gap-1 text-xs text-muted-foreground">
                Economics
                <ExplainButton
                  subject="economics score"
                  explain={() => explainEconomics(baseline, scenario, governanceScore, priorities)}
                />
              </span>
              <span className="font-mono text-2xl text-metric tabular-nums">{round(current.economics)}</span>
            </div>
            <div className="grid gap-1">
              <span className="-my-1 flex items-center gap-1 text-xs text-muted-foreground">
                Alignment
                <ExplainButton
                  subject="alignment score"
                  explain={() => explainAlignment(baseline, scenario, governanceScore, priorities)}
                />
              </span>
              <span className={cn("font-mono text-2xl tabular-nums", SEVERITY_TEXT[supportSeverity(current.alignment)])}>
                {round(current.alignment)}
              </span>
            </div>
            <p className={cn("col-span-2 text-sm font-medium", SEVERITY_TEXT[quadrant.severity])}>
              {quadrant.name}
            </p>
          </div>

          <div className="grid gap-3">
            <span className="text-xs text-muted-foreground">Stakeholder support</span>
            <ul className="grid gap-3">
              {current.stakeholders.map((s) => {
                const severity = supportSeverity(s.support);
                return (
                  <li key={s.id} className="grid gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{s.label}</span>
                      <span className={cn("font-mono tabular-nums", SEVERITY_TEXT[severity])}>{round(s.support)}</span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-label={`${s.label} support`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={round(s.support)}
                    >
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-300", SEVERITY_BAR[severity])}
                        style={{ width: `${s.support}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
