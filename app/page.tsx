import Link from "next/link";
import { Button } from "@/components/ui/button";

const signals = [
  { label: "Low risk", className: "text-positive bg-positive/10" },
  { label: "Perception gap", className: "text-caution bg-caution/10" },
  { label: "$4.2M valuation", className: "text-metric bg-metric/10" },
  { label: "Critical failure", className: "text-critical bg-critical/10" },
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-8 md:p-12">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">
          BridgeGen
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Private Company Decision Simulator
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          See the systemic consequences before you make the decision.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {signals.map((signal) => (
            <li
              key={signal.label}
              className={`rounded-md px-2.5 py-1 font-mono text-xs ${signal.className}`}
            >
              {signal.label}
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" nativeButton={false} render={<Link href="/simulator" />}>
            Run a simulation
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/pricing" />}>
            See pricing
          </Button>
          <Button size="lg" variant="ghost" nativeButton={false} render={<Link href="/walkthrough" />}>
            Watch the 3-minute walkthrough
          </Button>
        </div>
      </div>
    </main>
  );
}
