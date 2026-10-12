"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { HORIZONS } from "@/lib/projection/model";
import type { YearPoint } from "@/lib/projection/types";
import { formatMoney } from "@/lib/simulator/format";

const chartConfig = {
  a: { label: "Branch A", color: "var(--chart-5)" },
  b: { label: "Branch B", color: "var(--metric)" },
} satisfies ChartConfig;

interface Row {
  year: number;
  a: number;
  b: number;
}

function ProjectionTooltip({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  labels: { a: string; b: string };
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="grid gap-1.5 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <span className="font-medium text-foreground">Year {row.year}</span>
      {(["a", "b"] as const).map((key) => (
        <div key={key} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: chartConfig[key].color }} aria-hidden />
            {labels[key]}
          </span>
          <span className="font-mono text-foreground tabular-nums">{formatMoney(row[key])}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectionChart({
  a,
  b,
  labels,
}: {
  a: YearPoint[];
  b: YearPoint[];
  labels: { a: string; b: string };
}) {
  const rows: Row[] = a.map((point, i) => ({
    year: point.year,
    a: point.shareholderValue,
    b: b[i].shareholderValue,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-80 w-full"
      role="img"
      aria-label={`Shareholder value over 10 years. ${labels.a}: ${formatMoney(rows[10].a)} at year 10. ${labels.b}: ${formatMoney(rows[10].b)} at year 10.`}
    >
      <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 20, left: 8 }}>
        <CartesianGrid strokeDasharray="2 4" vertical={false} />
        {HORIZONS.map((h) => (
          <ReferenceLine key={h} x={h} stroke="var(--border)" />
        ))}
        <XAxis
          dataKey="year"
          type="number"
          domain={[0, 10]}
          ticks={[0, ...HORIZONS]}
          tickFormatter={(year: number) => (year === 0 ? "Now" : `${year}y`)}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          width={64}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => formatMoney(value)}
          domain={["auto", "auto"]}
        />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ProjectionTooltip labels={labels} />} />
        <Line dataKey="a" type="monotone" stroke="var(--color-a)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="b" type="monotone" stroke="var(--color-b)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}
