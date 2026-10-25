"use client";

import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Explanation } from "@/lib/explain/types";
import { ExplanationCard } from "./explanation-card";

/** Popup content renders only while open, so `explain` runs on open with current values. */
function ExplanationBody({ explain }: { explain: () => Explanation }) {
  return <ExplanationCard explanation={explain()} />;
}

/**
 * "Explain this" affordance: an icon button (or a labelled one when `children`
 * is given) that opens the glass-box explanation for one outcome.
 */
export function ExplainButton({
  subject,
  explain,
  children,
}: {
  /** What is being explained, for the accessible name: "Explain {subject}". */
  subject: string;
  explain: () => Explanation;
  children?: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={children ? "sm" : "icon"}
            aria-label={children ? undefined : `Explain ${subject}`}
            className="shrink-0 text-metric hover:text-foreground"
          />
        }
      >
        <Lightbulb data-icon={children ? "inline-start" : undefined} />
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto">
        <ExplanationBody explain={explain} />
      </PopoverContent>
    </Popover>
  );
}
