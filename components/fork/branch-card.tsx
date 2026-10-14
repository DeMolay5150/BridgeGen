"use client";

import { useId } from "react";
import { DeltaBadge } from "@/components/delta-badge";
import { SparkArea } from "@/components/spark-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BRANCH_OPTIONS, type ResolvedBranch } from "@/lib/projection/branches";
import type { BranchSpec, YearPoint } from "@/lib/projection/types";
import { describeScenario } from "@/lib/simulator/describe";
import { moneyDelta } from "@/lib/domain/delta";
import { formatMoney } from "@/lib/simulator/format";
import { cn } from "@/lib/utils";

export function BranchCard({
  name,
  swatch,
  color,
  spec,
  resolved,
  points,
  onChange,
}: {
  name: string;
  swatch: string;
  /** CSS colour matching `swatch`, for the sparkline. */
  color: string;
  spec: BranchSpec;
  resolved: ResolvedBranch;
  /** The branch's projection, year 0 to 10. */
  points: YearPoint[];
  onChange: (spec: BranchSpec) => void;
}) {
  const selectId = useId();
  const switchId = useId();
  const start = points[0].shareholderValue;
  const end = points[points.length - 1].shareholderValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", swatch)} aria-hidden />
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={selectId} className="text-xs text-muted-foreground">
            Starting point
          </Label>
          <Select
            items={BRANCH_OPTIONS}
            value={spec.source}
            onValueChange={(source) => {
              if (source) onChange({ ...spec, source });
            }}
          >
            <SelectTrigger id={selectId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BRANCH_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={switchId} className="grid gap-0.5">
            <span>Fix governance</span>
            <span className="text-xs font-normal text-muted-foreground">
              Model this branch with best-practice governance
            </span>
          </Label>
          <Switch
            id={switchId}
            checked={spec.fixGovernance}
            onCheckedChange={(fixGovernance) => onChange({ ...spec, fixGovernance })}
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{describeScenario(resolved.scenario, resolved.governanceScore)}</p>
        <div className="grid gap-2 border-t border-border pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">Shareholder value, year 10</span>
            <span className="font-mono text-lg text-metric tabular-nums">{formatMoney(end)}</span>
          </div>
          <DeltaBadge delta={moneyDelta(end, start)} against="over 10 years" />
          <SparkArea
            values={points.map((p) => p.shareholderValue)}
            color={color}
            label={`${name} shareholder value: ${formatMoney(start)} now, ${formatMoney(end)} in year 10.`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
