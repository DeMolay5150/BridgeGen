"use client";

import { useId, useState } from "react";
import { Segmented } from "@/components/segmented";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseNumber } from "@/lib/parse-number";
import { PLANS, formatUsd, type PlanId } from "@/lib/pricing/plans";
import { computeRoi } from "@/lib/pricing/roi";

function NumberField({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
}) {
  const id = useId();
  // Raw text while editing; null shows the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center font-mono text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={prefix ? "pl-6 font-mono" : "font-mono"}
          value={draft ?? value.toLocaleString("en-US")}
          onFocus={(e) => setDraft(e.currentTarget.value)}
          onChange={(e) => {
            setDraft(e.currentTarget.value);
            const parsed = parseNumber(e.currentTarget.value);
            if (parsed !== null) onChange(Math.max(parsed, 0));
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </div>
  );
}

/** PRICING.md Section 10.3: "What one engagement is worth". */
export function RoiCalculator() {
  const planLabelId = useId();
  const [fee, setFee] = useState(25_000);
  const [engagements, setEngagements] = useState(1);
  const [plan, setPlan] = useState<PlanId>("solo");
  const roi = computeRoi({ feePerEngagement: fee, extraEngagements: engagements, plan });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">Your numbers</CardTitle>
        <CardDescription>Placeholders shown; replace them with your own practice.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="grid content-start gap-4">
          <NumberField label="Your fee per owner engagement" prefix="$" value={fee} onChange={setFee} />
          <NumberField label="Extra engagements won or kept per year" value={engagements} onChange={setEngagements} />
          <div className="grid gap-1.5">
            <span id={planLabelId} className="text-xs text-muted-foreground">
              Plan
            </span>
            <Segmented
              labelId={planLabelId}
              value={plan}
              options={PLANS.map((p) => ({ value: p.id, label: p.id === "enterprise" ? "Enterprise" : p.name }))}
              onChange={setPlan}
            />
          </div>
        </div>
        <dl className="grid grid-cols-2 content-start gap-4 rounded-lg border border-border p-4" aria-live="polite">
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Return on the plan</dt>
            <dd className="font-mono text-4xl text-positive tabular-nums">
              {roi.returnMultiple === null ? "—" : `${roi.returnMultiple.toFixed(1)}×`}
            </dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Your annual upside</dt>
            <dd className="font-mono text-metric tabular-nums">{formatUsd(roi.annualUpside)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Plan, per year</dt>
            <dd className="font-mono tabular-nums">
              {plan === "enterprise" ? "from " : ""}
              {formatUsd(roi.annualPrice)}
            </dd>
          </div>
          <div className="col-span-2 grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Break-even</dt>
            <dd className="text-sm">
              {roi.breakEvenEngagements === null
                ? "Enter your fee to see break-even."
                : roi.breakEvenEngagements <= 1
                  ? "One engagement a year or less"
                  : `${roi.breakEvenEngagements.toFixed(1)} engagements a year`}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
