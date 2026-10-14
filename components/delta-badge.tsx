import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { KpiDelta } from "@/lib/domain/delta";
import { cn } from "@/lib/utils";

/**
 * Change against a reference point, Tremor BadgeDelta style: an arrow, the
 * signed change and what it's measured against. Green when the move is good
 * for shareholders, rose when it hurts, muted when flat or not judged.
 */
export function DeltaBadge({ delta, against = "vs. Today" }: { delta: KpiDelta; against?: string }) {
  const Icon = delta.direction === "flat" ? ArrowRight : delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums",
        delta.good === null ? "bg-muted text-muted-foreground" : delta.good ? "bg-positive/10 text-positive" : "bg-critical/10 text-critical",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {delta.direction === "flat" ? "No change" : delta.display}
      <span className="font-sans text-muted-foreground">{against}</span>
    </span>
  );
}
