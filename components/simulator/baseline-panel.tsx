"use client";

import { useId, useState, type ClipboardEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBaselinePaste } from "@/lib/clipboard/tsv";
import { parseNumber } from "@/lib/parse-number";
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
  const setBaseline = useSimulatorStore((s) => s.setBaseline);
  const [pasted, setPasted] = useState<number | null>(null);

  // A block copied from a spreadsheet (labels and values, or a row of numbers) fills every field at once.
  // Single values fall through to the field being pasted into.
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(text.trim())) return;
    const values = parseBaselinePaste(text);
    if (!values) return;
    event.preventDefault();
    const clamped = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, clamp(value, BASELINE_LIMITS[key as keyof Baseline])]),
    );
    setBaseline(clamped);
    setPasted(Object.keys(clamped).length);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company baseline</CardTitle>
        <CardDescription>
          Today&apos;s figures. Overwrite with the client&apos;s numbers, or paste a block straight from Excel.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4" onPaste={onPaste}>
        {pasted !== null && (
          <p role="status" className="col-span-2 rounded-lg bg-positive/10 px-3 py-2 text-xs text-positive">
            Filled {pasted} {pasted === 1 ? "field" : "fields"} from the spreadsheet.
          </p>
        )}
        {FIELDS.map((spec) => (
          <BaselineField key={spec.key} spec={spec} />
        ))}
      </CardContent>
    </Card>
  );
}
