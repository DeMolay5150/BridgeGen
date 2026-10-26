"use client";

import { useId, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HORIZONS } from "@/lib/projection/model";
import type { YearPoint } from "@/lib/projection/types";
import { formatMoney, formatMultiple, formatPercent } from "@/lib/simulator/format";
import { cn } from "@/lib/utils";

type Horizon = (typeof HORIZONS)[number];

type MetricKind = "money" | "multiple" | "percent";

interface MetricRow {
  label: string;
  kind: MetricKind;
  value: (p: YearPoint) => number | null;
  /** Whether a higher value is better for shareholders (colours the difference). */
  higherIsBetter: boolean;
}

const FORMATTERS: Record<MetricKind, (v: number) => string> = {
  money: formatMoney,
  multiple: formatMultiple,
  percent: formatPercent,
};

const format = (kind: MetricKind, v: number | null) => (v === null ? "n/a" : FORMATTERS[kind](v));

const ROWS: MetricRow[] = [
  { label: "Shareholder value", kind: "money", value: (p) => p.shareholderValue, higherIsBetter: true },
  { label: "Founder wealth", kind: "money", value: (p) => p.founderWealth, higherIsBetter: true },
  { label: "Next-gen wealth", kind: "money", value: (p) => p.nextGenWealth, higherIsBetter: true },
  { label: "Enterprise value", kind: "money", value: (p) => p.enterpriseValue, higherIsBetter: true },
  { label: "Debt", kind: "money", value: (p) => p.debt, higherIsBetter: false },
  { label: "Equity value", kind: "money", value: (p) => p.equityValue, higherIsBetter: true },
  { label: "Cash paid out to date", kind: "money", value: (p) => p.cumulativeCash, higherIsBetter: true },
  { label: "Expected Loss", kind: "money", value: (p) => p.expectedGovernanceLoss, higherIsBetter: false },
  { label: "Chance of governance crisis", kind: "percent", value: (p) => p.disruptionProbability, higherIsBetter: false },
  { label: "Interest coverage", kind: "multiple", value: (p) => p.interestCoverage, higherIsBetter: true },
];

function flagsOf(p: YearPoint): string {
  const flags = [
    p.flags.underwater && "Underwater",
    p.flags.thinCoverage && "Thin coverage",
    p.flags.debtGrowing && "Debt growing",
  ].filter(Boolean);
  return flags.length ? flags.join(", ") : "None";
}

function Difference({ row, a, b }: { row: MetricRow; a: YearPoint; b: YearPoint }) {
  const va = row.value(a);
  const vb = row.value(b);
  if (va === null || vb === null) return <span className="text-muted-foreground">—</span>;
  const diff = vb - va;
  if (Math.abs(diff) < 0.0005) return <span className="text-muted-foreground">Even</span>;
  const better = row.higherIsBetter ? diff > 0 : diff < 0;
  const sign = diff > 0 ? "+" : "−";
  return (
    <span className={better ? "text-positive" : "text-critical"}>
      {`${sign}${FORMATTERS[row.kind](Math.abs(diff))}`}
    </span>
  );
}

export function HorizonTable({
  a,
  b,
  labels,
}: {
  a: YearPoint[];
  b: YearPoint[];
  labels: { a: string; b: string };
}) {
  const labelId = useId();
  const [horizon, setHorizon] = useState<Horizon>(10);
  const pa = a[horizon];
  const pb = b[horizon];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={labelId} className="text-sm font-medium">
          Compare at
        </span>
        <ToggleGroup
          aria-labelledby={labelId}
          variant="outline"
          size="sm"
          spacing={0}
          value={[String(horizon)]}
          onValueChange={(next) => {
            const selected = Number(next[0]);
            if (HORIZONS.includes(selected as Horizon)) setHorizon(selected as Horizon);
          }}
        >
          {HORIZONS.map((h) => (
            <ToggleGroupItem key={h} value={String(h)} className="px-3">
              {h} {h === 1 ? "year" : "years"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div tabIndex={0} role="region" className="overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`Year ${horizon} comparison, scrolls sideways`}>
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-normal">Year {horizon}</th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-5" aria-hidden />A · {labels.a}
                </span>
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-metric" aria-hidden />B · {labels.b}
                </span>
              </th>
              <th scope="col" className="py-2 text-right font-normal">B vs A</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border/60">
                <th scope="row" className="py-2 pr-4 text-left font-sans font-normal">{row.label}</th>
                <td className="py-2 pr-4 text-right">{format(row.kind, row.value(pa))}</td>
                <td className="py-2 pr-4 text-right">{format(row.kind, row.value(pb))}</td>
                <td className="py-2 text-right">
                  <Difference row={row} a={pa} b={pb} />
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-4 text-left font-sans font-normal">Warnings</th>
              <td className={cn("py-2 pr-4 text-right font-sans", flagsOf(pa) !== "None" && "text-critical")}>{flagsOf(pa)}</td>
              <td className={cn("py-2 pr-4 text-right font-sans", flagsOf(pb) !== "None" && "text-critical")}>{flagsOf(pb)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
