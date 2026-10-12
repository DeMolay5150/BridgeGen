"use client";

import { useId } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SCENARIO_RANGES, type Range } from "@/lib/simulator/defaults";
import {
  formatMoney,
  formatMultiple,
  formatPercent,
  formatSignedPercent,
} from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";

interface SliderRowProps {
  label: string;
  hint: string;
  value: number;
  range: Range;
  display: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, hint, value, range, display, onChange }: SliderRowProps) {
  const labelId = useId();
  return (
    <div className="grid gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="grid gap-0.5">
          <span id={labelId} className="text-sm font-medium">
            {label}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
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

export function ScenarioControls() {
  const switchId = useId();
  const scenario = useSimulatorStore((s) => s.scenario);
  const setScenario = useSimulatorStore((s) => s.setScenario);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision levers</CardTitle>
        <CardDescription>Move a lever to see the consequences cascade.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-7">
        <SliderRow
          label="Debt leverage"
          hint="Total debt as a multiple of today's EBITDA"
          value={scenario.leverage}
          range={SCENARIO_RANGES.leverage}
          display={formatMultiple(scenario.leverage)}
          onChange={(leverage) => setScenario({ leverage })}
        />
        <SliderRow
          label="Equity transfer to next gen"
          hint="Share of the founder's stake gifted or sold to heirs"
          value={scenario.equityTransfer}
          range={SCENARIO_RANGES.equityTransfer}
          display={formatPercent(scenario.equityTransfer)}
          onChange={(equityTransfer) => setScenario({ equityTransfer })}
        />
        <SliderRow
          label="Valuation sensitivity"
          hint="Market shift in the EBITDA multiple"
          value={scenario.multipleShock}
          range={SCENARIO_RANGES.multipleShock}
          display={formatSignedPercent(scenario.multipleShock)}
          onChange={(multipleShock) => setScenario({ multipleShock })}
        />

        <div className="grid gap-5 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={switchId} className="grid gap-0.5">
              <span>Outside CEO</span>
              <span className="text-xs font-normal text-muted-foreground">
                Hire professional management instead of a family successor
              </span>
            </Label>
            <Switch
              id={switchId}
              checked={scenario.outsideCeo}
              onCheckedChange={(outsideCeo) => setScenario({ outsideCeo })}
            />
          </div>
          {scenario.outsideCeo && (
            <>
              <SliderRow
                label="CEO annual cost"
                hint="Salary, bonus and incentive equity"
                value={scenario.ceoCost}
                range={SCENARIO_RANGES.ceoCost}
                display={formatMoney(scenario.ceoCost)}
                onChange={(ceoCost) => setScenario({ ceoCost })}
              />
              <SliderRow
                label="EBITDA performance uplift"
                hint="Operating improvement the CEO delivers"
                value={scenario.ceoUplift}
                range={SCENARIO_RANGES.ceoUplift}
                display={formatSignedPercent(scenario.ceoUplift)}
                onChange={(ceoUplift) => setScenario({ ceoUplift })}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
