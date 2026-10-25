import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DeltaBadge } from "@/components/delta-badge";
import { ExplainButton } from "@/components/explain/explain-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  explainCoverage,
  explainDistribution,
  explainEnterpriseValue,
  explainEquity,
} from "@/lib/explain/simulator";
import type { Explanation } from "@/lib/explain/types";
import { COVERAGE_CAUTION, COVERAGE_CRITICAL } from "@/lib/simulator/engine";
import { moneyDelta, multipleDelta } from "@/lib/domain/delta";
import { formatMoney, formatMultiple, formatPercent } from "@/lib/simulator/format";
import type { Baseline, Holders, Scenario, Severity, SimulationResult } from "@/lib/simulator/types";

const SEVERITY_STYLES: Record<Severity, string> = {
  positive: "text-positive bg-positive/10",
  caution: "text-caution bg-caution/10",
  critical: "text-critical bg-critical/10",
};

const VALUE_TONE: Record<Severity | "metric", string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
  metric: "text-metric",
};

function Metric({
  label,
  value,
  detail,
  tone = "metric",
  delta,
  explain,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Severity | "metric";
  /** Change against Today, when the comparison is meaningful. */
  delta?: ReactNode;
  explain: () => Explanation;
}) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <div className="-my-1 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <ExplainButton subject={label.toLowerCase()} explain={explain}>
            Why?
          </ExplainButton>
        </div>
        <span className={cn("font-mono text-2xl tabular-nums", VALUE_TONE[tone])}>{value}</span>
        {delta}
        <span className="text-sm text-muted-foreground">{detail}</span>
      </CardContent>
    </Card>
  );
}

const HOLDERS: { key: keyof Holders; label: string; swatch: string }[] = [
  { key: "founder", label: "Founder", swatch: "bg-metric" },
  { key: "nextGen", label: "Next generation", swatch: "bg-positive" },
  { key: "others", label: "Other shareholders", swatch: "bg-chart-5" },
];

function OwnershipSplit({ result }: { result: SimulationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership after the decision</CardTitle>
        <CardDescription>Equity value and recap cash by holder</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div
          className="flex h-2.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={HOLDERS.map((h) => `${h.label} ${formatPercent(result.ownership[h.key])}`).join(", ")}
        >
          {HOLDERS.map((h) => (
            <div
              key={h.key}
              className={cn("h-full transition-[width] duration-300", h.swatch)}
              style={{ width: `${result.ownership[h.key] * 100}%` }}
            />
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {HOLDERS.map((h) => (
            <li key={h.key} className="grid gap-0.5">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", h.swatch)} aria-hidden />
                {h.label}
              </span>
              <span className="font-mono text-sm tabular-nums">
                {formatPercent(result.ownership[h.key])} · {formatMoney(result.holderEquity[h.key])}
              </span>
              {distributionDirection(result.netDistribution) !== 0 && (
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {result.netDistribution > 0
                    ? `+${formatMoney(result.holderDistribution[h.key])} recap`
                    : `${formatMoney(-result.holderDistribution[h.key])} to fund`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** 1 = recap payout, -1 = capital required, 0 = no change (ignoring float noise under $500). */
function distributionDirection(netDistribution: number): -1 | 0 | 1 {
  if (Math.abs(netDistribution) < 0.0005) return 0;
  return netDistribution > 0 ? 1 : -1;
}

function coverageTone(coverage: number | null): Severity | "metric" {
  if (coverage === null) return "metric";
  if (coverage < COVERAGE_CRITICAL) return "critical";
  if (coverage < COVERAGE_CAUTION) return "caution";
  return "positive";
}

/** Only comparable when both sides carry debt. */
function coverageBadge(now: number | null, then: number | null) {
  const delta = multipleDelta(now, then, true);
  return delta ? <DeltaBadge delta={delta} /> : undefined;
}

export function ResultsPanel({
  result,
  today,
  baseline,
  scenario,
}: {
  result: SimulationResult;
  /** The company with no decision taken, for the deltas. */
  today: SimulationResult;
  baseline: Baseline;
  scenario: Scenario;
}) {
  const direction = distributionDirection(result.netDistribution);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric
          label="Enterprise value"
          value={formatMoney(result.enterpriseValue)}
          detail={`${formatMoney(result.adjustedEbitda)} EBITDA × ${formatMultiple(result.effectiveMultiple)}`}
          delta={<DeltaBadge delta={moneyDelta(result.enterpriseValue, today.enterpriseValue)} />}
          explain={() => explainEnterpriseValue(baseline, scenario)}
        />
        <Metric
          label="Equity value"
          value={formatMoney(result.equityValue)}
          detail={
            result.equityValue <= 0
              ? "Underwater: debt exceeds enterprise value"
              : `After ${formatMoney(result.totalDebt)} of debt`
          }
          tone={result.equityValue <= 0 ? "critical" : "metric"}
          delta={<DeltaBadge delta={moneyDelta(result.equityValue, today.equityValue)} />}
          explain={() => explainEquity(baseline, scenario)}
        />
        <Metric
          label={direction < 0 ? "Capital required" : "Cash paid out (dividend recap)"}
          value={formatMoney(Math.abs(result.netDistribution))}
          detail={
            direction > 0
              ? "New borrowing paid out to shareholders"
              : direction < 0
                ? "Shareholders fund the debt paydown"
                : "No change to borrowing"
          }
          tone={direction < 0 ? "caution" : "metric"}
          explain={() => explainDistribution(baseline, scenario)}
        />
        <Metric
          label="Interest coverage"
          value={formatMultiple(result.interestCoverage)}
          detail={`Times profit covers interest. Debt ${formatMultiple(result.debtToEbitda)} EBITDA · ${formatMoney(result.interestExpense)}/yr interest`}
          tone={coverageTone(result.interestCoverage)}
          delta={coverageBadge(result.interestCoverage, today.interestCoverage)}
          explain={() => explainCoverage(baseline, scenario)}
        />
      </div>

      <OwnershipSplit result={result} />

      <Card>
        <CardHeader>
          <CardTitle>Risk signals</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2" aria-live="polite">
            {result.signals.map((signal) => (
              <li key={signal.id} className={cn("grid gap-0.5 rounded-lg px-3 py-2", SEVERITY_STYLES[signal.severity])}>
                <span className="text-sm font-medium">{signal.title}</span>
                <span className="text-sm text-foreground/85">{signal.detail}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
