"use client";

import { useId } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BRANCH_OPTIONS, type ResolvedBranch } from "@/lib/projection/branches";
import type { BranchSpec } from "@/lib/projection/types";
import { describeScenario } from "@/lib/simulator/describe";
import { cn } from "@/lib/utils";

export function BranchCard({
  name,
  swatch,
  spec,
  resolved,
  onChange,
}: {
  name: string;
  swatch: string;
  spec: BranchSpec;
  resolved: ResolvedBranch;
  onChange: (spec: BranchSpec) => void;
}) {
  const selectId = useId();
  const switchId = useId();

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
      </CardContent>
    </Card>
  );
}
