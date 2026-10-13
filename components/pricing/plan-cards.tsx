"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { Segmented } from "@/components/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS, TRIAL_HREF, formatUsd, salesHref, type Plan } from "@/lib/pricing/plans";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

function Price({ plan, billing }: { plan: Plan; billing: Billing }) {
  if (plan.monthly === null || plan.isFromPrice) {
    return (
      <p className="flex items-baseline gap-1.5">
        <span className="text-sm text-muted-foreground">from</span>
        <span className="font-mono text-3xl text-foreground tabular-nums">{formatUsd(plan.annual)}</span>
        <span className="text-sm text-muted-foreground">/ year</span>
      </p>
    );
  }
  const amount = billing === "monthly" ? plan.monthly : plan.annual;
  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-baseline gap-1.5">
        <span className="font-mono text-3xl text-foreground tabular-nums">{formatUsd(amount)}</span>
        <span className="text-sm text-muted-foreground">
          / {billing === "monthly" ? "month" : "year"}
          {plan.priceNote ? ` ${plan.priceNote}` : ""}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {billing === "monthly"
          ? `or ${formatUsd(plan.annual)} / year, two months free`
          : `${formatUsd(plan.annual / 12)} / month, billed annually`}
      </p>
    </div>
  );
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const href = plan.cta.kind === "trial" ? TRIAL_HREF : salesHref();
  const featured = Boolean(plan.badge);
  return (
    <Card className={cn("h-full", featured && "ring-metric/50")}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{plan.name}</CardTitle>
          {plan.badge && (
            <span className="rounded-md bg-metric/10 px-2 py-0.5 text-xs font-medium text-metric">{plan.badge}</span>
          )}
        </div>
        <CardDescription>{plan.audience}</CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 content-start gap-5">
        <Price plan={plan} billing={billing} />
        <ul className="grid gap-2.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature.text} className="flex gap-2">
              {feature.status === "available" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
              ) : (
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className={cn(feature.status === "coming-soon" && "text-muted-foreground")}>
                {feature.text}
                {feature.status === "coming-soon" && <span className="ml-1.5 text-xs text-caution">Coming soon</span>}
              </span>
            </li>
          ))}
        </ul>
        {plan.extra && <p className="text-xs text-muted-foreground">{plan.extra}</p>}
      </CardContent>
      <CardFooter className="bg-transparent">
        <Button
          className="w-full"
          variant={featured ? "default" : "outline"}
          nativeButton={false}
          render={<Link href={href} />}
        >
          {plan.cta.label}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function PlanCards() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const labelId = useId();

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span id={labelId} className="text-sm text-muted-foreground">
          Billing
        </span>
        <Segmented
          labelId={labelId}
          value={billing}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: "Annual · 2 months free" },
          ]}
          onChange={setBilling}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billing={billing} />
        ))}
      </div>
    </div>
  );
}
