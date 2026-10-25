"use client";

import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import type { Range } from "@/lib/simulator/defaults";

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  range: Range;
  display: string;
  onChange: (value: number) => void;
}

/** A labelled slider with a live value readout. */
export function SliderRow({ label, hint, value, range, display, onChange }: SliderRowProps) {
  const labelId = useId();
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="grid gap-0.5">
          <span id={labelId} className="text-sm font-medium">
            {label}
          </span>
          <span className="text-sm text-muted-foreground">{hint}</span>
        </div>
        <span className="shrink-0 font-mono text-sm text-metric tabular-nums">{display}</span>
      </div>
      <Slider
        aria-labelledby={labelId}
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
      />
    </div>
  );
}
