import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { INTERACTION_LABEL } from "@/lib/explain/attribution";
import type { Explanation } from "@/lib/explain/types";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

const STEP_TONE: Record<Severity, string> = {
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};

export function ExplanationCard({ explanation }: { explanation: Explanation }) {
  const { title, summary, steps, drivers, note } = explanation;
  const largest = Math.max(...(drivers ?? []).map((d) => Math.abs(d.effect)), 0);

  return (
    <div className="grid gap-4 text-sm">
      <div className="grid gap-1">
        <PopoverTitle className="font-heading text-base">{title}</PopoverTitle>
        <PopoverDescription className="text-xs">{summary}</PopoverDescription>
      </div>

      <ol className="grid gap-2">
        {steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_1fr] gap-2">
            <span className="font-mono text-xs leading-5 text-muted-foreground">{i + 1}</span>
            <span className={cn("leading-5", step.tone && STEP_TONE[step.tone])}>{step.text}</span>
          </li>
        ))}
      </ol>

      {drivers && drivers.length > 0 && (
        <div className="grid gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">What drove it (vs. today)</span>
          <ul className="grid gap-2">
            {drivers.map((d) => (
              <li key={d.lever} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-4">
                  <span className={cn(d.lever === INTERACTION_LABEL && "text-muted-foreground")}>{d.lever}</span>
                  <span className={cn("font-mono tabular-nums", d.tone === "positive" ? "text-positive" : "text-critical")}>
                    {d.display}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", d.tone === "positive" ? "bg-positive" : "bg-critical")}
                    style={{ width: `${largest > 0 ? (Math.abs(d.effect) / largest) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note && <p className="border-t border-border pt-3 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
