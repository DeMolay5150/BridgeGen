import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecutiveBrief } from "@/lib/narrative/types";
import type { Severity } from "@/lib/simulator/types";
import { cn } from "@/lib/utils";

const TONE_BORDER: Record<Severity, string> = {
  positive: "border-positive",
  caution: "border-caution",
  critical: "border-critical",
};

/** Bottom line up front, the evidence, then the recommended actions. */
export function BriefCard({ brief, description }: { brief: ExecutiveBrief; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executive summary</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className={cn("border-l-2 pl-3 text-base leading-relaxed text-foreground", TONE_BORDER[brief.tone])}>
          {brief.headline}
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <section className="grid content-start gap-2" aria-label="Key findings">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Key findings</h3>
            <ul className="grid gap-2 text-sm">
              {brief.findings.map((finding) => (
                <li key={finding} className="grid grid-cols-[0.75rem_1fr] gap-2">
                  <span className="mt-2 size-1 rounded-full bg-metric" aria-hidden />
                  <span className="leading-relaxed text-muted-foreground">{finding}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="grid content-start gap-2" aria-label="Recommended actions">
            <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recommended actions</h3>
            <ol className="grid gap-2 text-sm">
              {brief.actions.map((action, i) => (
                <li key={action} className="grid grid-cols-[1.25rem_1fr] gap-2">
                  <span className="font-mono text-xs leading-relaxed text-metric">{i + 1}</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
