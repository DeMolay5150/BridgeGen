"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { compareLiquidity, type CaseResult } from "@/lib/alerts/liquidity";
import { formatMoney } from "@/lib/simulator/format";
import { useSimulatorStore } from "@/lib/simulator/store";
import { DEFAULT_STATEMENT_ASSUMPTIONS } from "@/lib/statements/model";
import { cn } from "@/lib/utils";

function CaseCell({ result }: { result: CaseResult }) {
  if (result.alerts.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-positive/10 px-3 py-2 text-sm text-positive">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Clear. Weakest year still generates {formatMoney(result.worstFreeCashFlow)} of free cash flow.
        </span>
      </div>
    );
  }
  return (
    <ul className="grid gap-2">
      {result.alerts.map((alert) => {
        const Icon = alert.severity === "critical" ? OctagonAlert : AlertTriangle;
        return (
          <li
            key={alert.kind}
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2",
              alert.severity === "critical" ? "bg-critical/10 text-critical" : "bg-caution/10 text-caution",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{alert.title}</span>
              <span className="text-xs text-foreground/70">{alert.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Cash-side stress test from the three-statement model: covenant breaches,
 * revolver draws and repayment gaps, today vs the scenario, in the base case
 * and in a downturn.
 */
export function LiquidityCard() {
  const baseline = useSimulatorStore((s) => s.baseline);
  const scenario = useSimulatorStore((s) => s.scenario);
  const growth = useSimulatorStore((s) => s.fork.assumptions.ebitdaGrowth);
  const comparison = useMemo(
    () => compareLiquidity(baseline, scenario, { ...DEFAULT_STATEMENT_ASSUMPTIONS, revenueGrowth: growth }),
    [baseline, scenario, growth],
  );

  const rows = [
    { label: "Today", result: comparison.today },
    { label: "Your scenario", result: comparison.scenario },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidity &amp; covenant alerts</CardTitle>
        <CardDescription>
          Ten years of the three-statement model: covenant breaches, revolver draws and repayment gaps. The downturn
          cuts revenue 15% and margin 2 points in year 1, then recovers.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="hidden grid-cols-[8rem_1fr_1fr] gap-4 text-xs text-muted-foreground md:grid">
          <span />
          <span>Base case</span>
          <span>Downturn</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="grid gap-3 border-t border-border pt-4 md:grid-cols-[8rem_1fr_1fr] md:gap-4">
            <span className="text-sm font-medium">{row.label}</span>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground md:hidden">Base case</span>
              <CaseCell result={row.result.base} />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs text-muted-foreground md:hidden">Downturn</span>
              <CaseCell result={row.result.downturn} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
