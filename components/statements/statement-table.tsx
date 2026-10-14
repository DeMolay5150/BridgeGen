"use client";

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTsv } from "@/lib/clipboard/tsv";
import type { StatementYear } from "@/lib/statements/model";
import { cn } from "@/lib/utils";

export interface StatementLine {
  label: string;
  value: (y: StatementYear) => number | null;
  format?: "money" | "multiple";
  /** Totals and subtotals. */
  strong?: boolean;
  /** Rows to read as a warning when non-zero (e.g. revolver draws). */
  flag?: boolean;
}

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Accounting style: $M to one decimal, negatives in brackets, "–" for nothing. */
function display(value: number | null, format: StatementLine["format"] = "money"): string {
  if (value === null) return "n/a";
  if (format === "multiple") return `${value.toFixed(1)}x`;
  if (Math.abs(value) < 0.05) return "–";
  return value < 0 ? `(${money.format(-value)})` : money.format(value);
}

/**
 * One financial statement, years as columns. "Copy to Excel" puts the full-
 * precision figures on the clipboard as TSV; selecting cells and copying works too.
 */
export function StatementTable({
  title,
  lines,
  years,
}: {
  title: string;
  lines: StatementLine[];
  years: StatementYear[];
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const copy = async () => {
    const tsv = toTsv([
      [`${title} ($M)`, ...years.map((y) => `Year ${y.year}`)],
      ...lines.map((line) => [line.label, ...years.map((y) => line.value(y))]),
    ]);
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2_000);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">$ millions · year 0 is straight after the decision</span>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied === "done" ? <Check data-icon="inline-start" /> : <ClipboardCopy data-icon="inline-start" />}
          {copied === "done" ? "Copied" : copied === "failed" ? "Copy blocked" : "Copy to Excel"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[52rem] border-collapse text-xs">
          <caption className="sr-only">{title}, $ millions by year</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="sticky left-0 bg-card px-3 py-2 text-left font-normal">
                {title}
              </th>
              {years.map((y) => (
                <th key={y.year} scope="col" className="px-2 py-2 text-right font-mono font-normal">
                  {y.year === 0 ? "Y0" : `Y${y.year}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {lines.map((line) => (
              <tr key={line.label} className={cn("border-b border-border/50 last:border-0", line.strong && "bg-muted/30")}>
                <th scope="row" className={cn("sticky left-0 bg-card px-3 py-1.5 text-left font-sans font-normal", line.strong && "font-medium")}>
                  {line.label}
                </th>
                {years.map((y) => {
                  const value = line.value(y);
                  return (
                    <td
                      key={y.year}
                      className={cn(
                        "px-2 py-1.5 text-right",
                        line.strong ? "text-foreground" : "text-muted-foreground",
                        line.flag && value !== null && Math.abs(value) >= 0.05 && "text-caution",
                      )}
                    >
                      {display(value, line.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
