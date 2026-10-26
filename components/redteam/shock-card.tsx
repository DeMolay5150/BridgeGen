"use client";

import Link from "next/link";
import { ExplainButton } from "@/components/explain/explain-button";
import { explainShock } from "@/lib/explain/redteam";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GOVERNANCE_AREA, describeChanges } from "@/lib/redteam/describe";
import type { ShockResult, StressMetrics, Verdict } from "@/lib/redteam/types";
import { formatMoney, formatMultiple } from "@/lib/simulator/format";
import { cn } from "@/lib/utils";

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  survives: { label: "Survives", className: "text-positive bg-positive/10" },
  strained: { label: "Strained", className: "text-caution bg-caution/10" },
  breaks: { label: "Breaks", className: "text-critical bg-critical/10" },
};

const ROWS: { label: string; value: (m: StressMetrics) => string }[] = [
  { label: "Enterprise value", value: (m) => formatMoney(m.enterpriseValue) },
  { label: "Equity value", value: (m) => formatMoney(m.equityValue) },
  { label: "Interest coverage", value: (m) => formatMultiple(m.interestCoverage) },
  { label: "Debt / EBITDA", value: (m) => formatMultiple(m.debtToEbitda) },
];

export function ShockCard({ shock }: { shock: ShockResult }) {
  const verdict = VERDICT[shock.verdict];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <CardTitle as="h3">{shock.name}</CardTitle>
            <CardDescription>{shock.description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className={cn("rounded-md px-2 py-1 text-xs font-medium", verdict.className)}>
              {verdict.label}
            </span>
            <ExplainButton subject={`the ${shock.name.toLowerCase()} result`} explain={() => explainShock(shock)} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="font-mono text-xs text-muted-foreground">{describeChanges(shock.changes)}</p>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1 font-normal">
                <span className="sr-only">Metric</span>
              </th>
              <th scope="col" className="pb-1 text-right font-normal">Before</th>
              <th scope="col" className="pb-1 text-right font-normal">After</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border/60">
                <th scope="row" className="py-1.5 text-left font-sans font-normal">{row.label}</th>
                <td className="py-1.5 text-right text-muted-foreground">{row.value(shock.before)}</td>
                <td className="py-1.5 text-right">{row.value(shock.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span>Value destroyed</span>
          <span className={cn("font-mono tabular-nums", shock.valueDestroyed > 0.05 ? "text-critical" : "text-muted-foreground")}>
            {formatMoney(Math.max(shock.valueDestroyed, 0))}
          </span>
        </div>

        {shock.warnings.length > 0 && (
          <ul className="grid gap-1.5">
            {shock.warnings.map((w) => (
              <li key={w} className="text-xs text-caution">{w}</li>
            ))}
          </ul>
        )}

        {shock.dividend && (
          <p className="rounded-lg bg-positive/10 px-3 py-2 text-xs text-positive">
            With best-practice {shock.dividend.categories.map((c) => GOVERNANCE_AREA[c]).join(", ")}:{" "}
            {describeChanges(shock.dividend.changes)}
            {shock.dividend.valueSaved > 0.05 && <>, saving {formatMoney(shock.dividend.valueSaved)}</>}.{" "}
            <Link href="/governance" className="underline underline-offset-4">
              Close the gaps
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
