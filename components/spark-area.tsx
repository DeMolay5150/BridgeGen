"use client";

import { useId } from "react";
import { Area, AreaChart, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Axis-free trend line with a soft fill (Tremor SparkAreaChart pattern).
 * Decorative: pass the takeaway in `label` so screen readers get the numbers.
 */
export function SparkArea({
  values,
  color,
  label,
  className,
}: {
  values: number[];
  /** A CSS colour, e.g. "var(--metric)". */
  color: string;
  label: string;
  className?: string;
}) {
  const gradientId = `spark-${useId().replace(/:/g, "")}`;
  const config = { value: { label, color } } satisfies ChartConfig;
  const data = values.map((value, index) => ({ index, value }));

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-10 w-full", className)} role="img" aria-label={label}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
