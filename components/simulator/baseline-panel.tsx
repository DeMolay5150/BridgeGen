"use client";

import { useId, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASELINE_LIMITS, clamp } from "@/lib/simulator/defaults";
import { useSimulatorStore } from "@/lib/simulator/store";
import type { Baseline } from "@/lib/simulator/types";

interface FieldSpec {
  key: keyof Baseline;
  label: string;
  unit: "$M" | "x" | "%";
}

const FIELDS: FieldSpec[] = [
  { key: "revenue", label: "Revenue", unit: "$M" },
  { key: "ebitda", label: "EBITDA", unit: "$M" },
  { key: "multiple", label: "EBITDA multiple", unit: "x" },
  { key: "existingDebt", label: "Existing debt", unit: "$M" },
  { key: "interestRate", label: "Interest rate", unit: "%" },
  { key: "founderOwnership", label: "Founder ownership", unit: "%" },
];

/** Percent fields are edited as whole percentages but stored as fractions. */
const toDisplay = (value: number, unit: FieldSpec["unit"]) =>
  String(unit === "%" ? Math.round(value * 10_000) / 100 : value);

/** Accepts pasted values like "$12,000,000" → 12000000 or "8%" → 8; null if unparseable. */
function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[$,%\sx]/gi, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function BaselineField({ spec }: { spec: FieldSpec }) {
  const id = useId();
  const value = useSimulatorStore((s) => s.baseline[spec.key]);
  const setBaseline = useSimulatorStore((s) => s.setBaseline);
  // Raw text while the field is being edited; null shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    const parsed = parseNumber(text);
    if (parsed === null) return;
    const stored = spec.unit === "%" ? parsed / 100 : parsed;
    setBaseline({ [spec.key]: clamp(stored, BASELINE_LIMITS[spec.key]) });
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {spec.label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pr-9 font-mono"
          value={draft ?? toDisplay(value, spec.unit)}
          onFocus={(e) => setDraft(e.currentTarget.value)}
          onChange={(e) => {
            setDraft(e.currentTarget.value);
            commit(e.currentTarget.value);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center font-mono text-xs text-muted-foreground">
          {spec.unit}
        </span>
      </div>
    </div>
  );
}

export function BaselinePanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company baseline</CardTitle>
        <CardDescription>Today&apos;s figures. Overwrite with the client&apos;s numbers.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {FIELDS.map((spec) => (
          <BaselineField key={spec.key} spec={spec} />
        ))}
      </CardContent>
    </Card>
  );
}
