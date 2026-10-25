"use client";

import { useId } from "react";
import { SliderRow } from "@/components/slider-row";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SCENARIO_RANGES, leverageRange } from "@/lib/simulator/defaults";
import {
  formatMoney,
  formatMultiple,
  formatPercent,
  formatSignedPercent,
} from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";

export function ScenarioControls() {
  const switchId = useId();
  const baseline = useSimulatorStore((s) => s.baseline);
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
          hint="Total debt, as years of today's operating profit (EBITDA)"
          value={scenario.leverage}
          range={leverageRange(baseline)}
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
          hint="How much buyers' pricing for businesses like this rises or falls"
          value={scenario.multipleShock}
          range={SCENARIO_RANGES.multipleShock}
          display={formatSignedPercent(scenario.multipleShock)}
          onChange={(multipleShock) => setScenario({ multipleShock })}
        />

        <div className="grid gap-5 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={switchId} className="grid gap-0.5">
              <span>Outside CEO</span>
              <span className="text-sm font-normal text-muted-foreground">
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
