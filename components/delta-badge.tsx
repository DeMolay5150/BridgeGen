import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Change against a reference point, Tremor BadgeDelta style: an arrow, the
 * signed change and what it's measured against. Green when the move is good
 * for shareholders, rose when it hurts, muted when it's within `tolerance`.
 */
export function DeltaBadge({
  delta,
  display,
  against = "vs. Today",
  higherIsBetter = true,
  tolerance = 0,
}: {
  delta: number;
  /** The signed change as text, e.g. "+$4.0M". */
  display: string;
  against?: string;
  higherIsBetter?: boolean;
  tolerance?: number;
}) {
  const flat = Math.abs(delta) <= tolerance;
  const good = flat ? null : delta > 0 === higherIsBetter;
  const Icon = flat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums",
        good === null ? "bg-muted text-muted-foreground" : good ? "bg-positive/10 text-positive" : "bg-critical/10 text-critical",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {flat ? "No change" : display}
      <span className="font-sans text-muted-foreground">{against}</span>
    </span>
  );
}
