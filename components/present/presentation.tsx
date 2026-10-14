"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { DeltaBadge } from "@/components/delta-badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { moneyDelta, multipleDelta, type KpiDelta } from "@/lib/domain/delta";
import { SHOCKS, runShock } from "@/lib/redteam/shocks";
import { scoreScenario } from "@/lib/simulator/alignment";
import { SCENARIO_RANGES, neutralScenario } from "@/lib/simulator/defaults";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL, simulate } from "@/lib/simulator/engine";
import { formatMoney, formatMultiple, formatPercent, formatSignedPercent } from "@/lib/simulator/format";
import { selectGovernanceScore, useSimulatorStore } from "@/lib/simulator/store";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

const TONE: Record<Severity | "metric", string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
  metric: "text-metric",
};

function Lever({
  label,
  hint,
  value,
  display,
  range,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  display: string;
  range: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="grid gap-0.5">
          <span id={id} className="text-lg font-medium">
            {label}
          </span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </div>
        <span className="font-mono text-xl text-metric tabular-nums">{display}</span>
      </div>
      <Slider
        aria-labelledby={id}
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
  tone = "metric",
  delta,
  word = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Severity | "metric";
  delta?: KpiDelta | null;
  /** A verdict in words rather than a figure: set in the heading face, sized to fit. */
  word?: boolean;
}) {
  return (
    <div className="grid content-start gap-2 rounded-xl border border-border bg-card p-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          word ? "font-heading text-3xl font-semibold tracking-tight md:text-4xl" : "font-mono text-4xl tabular-nums md:text-5xl",
          TONE[tone],
        )}
      >
        {value}
      </span>
      {delta && <DeltaBadge delta={delta} />}
      <span className="text-sm text-muted-foreground">{detail}</span>
    </div>
  );
}

/**
 * Client meeting mode: four plain-language levers and the outcomes that
 * matter to a family, full screen. Nothing else is editable or visible:
 * no baseline inputs, governance answers, stakeholder data or exports.
 */
export function Presentation() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const governance = useSimulatorStore((s) => s.governance);
  const priorities = useSimulatorStore((s) => s.priorities);
  const governanceScore = useSimulatorStore(selectGovernanceScore);
  const setScenario = useSimulatorStore((s) => s.setScenario);
  const companyName = useSimulatorStore((s) => s.companyName) ?? "Demo company";
  const ceoId = useId();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const view = useMemo(() => {
    const neutral = neutralScenario(baseline);
    const result = simulate(baseline, scenario, governanceScore);
    const today = simulate(baseline, neutral, governanceScore);
    const failed = SHOCKS.filter((s) => runShock(baseline, scenario, governance, s.id).verdict === "breaks").length;
    const alignment = scoreScenario(baseline, scenario, governanceScore, priorities).alignment;
    const todayAlignment = scoreScenario(baseline, neutral, governanceScore, priorities).alignment;
    return { neutral, result, today, failed, alignment, todayAlignment };
  }, [baseline, scenario, governance, governanceScore, priorities]);

  const { result, today } = view;
  const cash = result.netDistribution;
  const coverage = result.interestCoverage;
  const safety: { word: string; tone: Severity } =
    coverage === null || coverage >= COVERAGE_CAUTION
      ? { word: "Comfortable", tone: "positive" }
      : coverage >= COVERAGE_CRITICAL
        ? { word: "Tight", tone: "caution" }
        : { word: "At risk", tone: "critical" };
  const alignmentTone: Severity = view.alignment >= 65 ? "positive" : view.alignment >= 40 ? "caution" : "critical";
  const alignmentDelta = Math.round(view.alignment) - Math.round(view.todayAlignment);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto grid min-h-full w-full max-w-7xl content-start gap-8 px-4 py-6 md:px-10 md:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="grid gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-metric">BridgeGen · Client session</span>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-white md:text-4xl">{companyName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setScenario(view.neutral)}>
              <RotateCcw data-icon="inline-start" />
              Back to today
            </Button>
            <Button variant="outline" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize2 data-icon="inline-start" /> : <Maximize2 data-icon="inline-start" />}
              {fullscreen ? "Exit full screen" : "Full screen"}
            </Button>
            <Button variant="ghost" nativeButton={false} render={<Link href="/simulator" />}>
              <X data-icon="inline-start" />
              Leave
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <section className="grid gap-8 rounded-xl border border-border bg-card p-6" aria-label="Decision levers">
            <Lever
              label="Borrowing"
              hint="Debt as a multiple of today's earnings"
              value={scenario.leverage}
              display={`${scenario.leverage.toFixed(2)}x`}
              range={SCENARIO_RANGES.leverage}
              onChange={(leverage) => setScenario({ leverage })}
            />
            <Lever
              label="Shares to the next generation"
              hint="Of the founder's stake"
              value={scenario.equityTransfer}
              display={formatPercent(scenario.equityTransfer)}
              range={SCENARIO_RANGES.equityTransfer}
              onChange={(equityTransfer) => setScenario({ equityTransfer })}
            />
            <Lever
              label="Market mood"
              hint="How buyers value businesses like this"
              value={scenario.multipleShock}
              display={formatSignedPercent(scenario.multipleShock)}
              range={SCENARIO_RANGES.multipleShock}
              onChange={(multipleShock) => setScenario({ multipleShock })}
            />
            <div className="flex items-center justify-between gap-4">
              <label htmlFor={ceoId} className="grid gap-0.5">
                <span className="text-lg font-medium">Hire an outside CEO</span>
                <span className="text-sm text-muted-foreground">Professional management instead of a family successor</span>
              </label>
              <Switch id={ceoId} checked={scenario.outsideCeo} onCheckedChange={(outsideCeo) => setScenario({ outsideCeo })} />
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Outcomes" aria-live="polite">
            <Tile label="What the company is worth" value={formatMoney(result.enterpriseValue)} detail="Enterprise value" delta={moneyDelta(result.enterpriseValue, today.enterpriseValue)} />
            <Tile
              label="The family's equity"
              value={formatMoney(result.equityValue)}
              detail={result.equityValue <= 0 ? "Debt exceeds the company's value" : "Value after all debt"}
              tone={result.equityValue <= 0 ? "critical" : "metric"}
              delta={moneyDelta(result.equityValue, today.equityValue)}
            />
            <Tile
              label={cash < -0.0005 ? "Capital the family puts in" : "Cash to the family now"}
              value={formatMoney(Math.abs(cash))}
              detail={cash > 0.0005 ? "Paid out from new borrowing" : cash < -0.0005 ? "To pay down debt" : "No change to borrowing"}
              tone={cash < -0.0005 ? "caution" : "metric"}
            />
            <Tile
              label="Debt safety"
              value={safety.word}
              word
              detail={coverage === null ? "No interest to cover" : `Earnings cover interest ${formatMultiple(coverage)}`}
              tone={safety.tone}
              delta={multipleDelta(coverage, today.interestCoverage, true)}
            />
            <Tile
              label="Family alignment"
              value={`${Math.round(view.alignment)}/100`}
              detail={alignmentDelta === 0 ? "Same as today" : `${alignmentDelta > 0 ? "+" : "−"}${Math.abs(alignmentDelta)} vs. today`}
              tone={alignmentTone}
            />
            <Tile
              label="Stress tests"
              value={view.failed === 0 ? "Passes all 4" : `Fails ${view.failed} of 4`}
              word
              detail="Founder incapacity, successor exit, downturn, all three"
              tone={view.failed === 0 ? "positive" : view.failed >= 2 ? "critical" : "caution"}
            />
          </section>
        </div>

        <p className="text-xs text-muted-foreground">
          Illustrative figures from BridgeGen&apos;s deterministic models under the stated assumptions. Not a valuation or investment advice.
        </p>
      </div>
    </div>
  );
}
