import Link from "next/link";
import { Button } from "@/components/ui/button";

/** A first-time visitor's path: one place to start, in plain words. */
const steps = [
  "Enter today's figures for the company, or keep the demo family business.",
  "Move one lever, such as borrowing or shares passed to the next generation.",
  "Read what changes for the founder, the heirs, the board and the lender.",
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
        <ol className="mt-8 grid gap-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-base text-foreground/90">
              <span className="font-mono text-metric">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" className="h-11 px-5 text-base" nativeButton={false} render={<Link href="/simulator" />}>
            Start with the simulator
          </Button>
          <Button size="lg" variant="outline" className="h-11 px-5 text-base" nativeButton={false} render={<Link href="/walkthrough" />}>
            Watch the 3-minute walkthrough
          </Button>
        </div>
        <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4 hover:text-foreground">
            Pricing
          </Link>
          <Link href="/white-paper" className="underline underline-offset-4 hover:text-foreground">
            Read the white paper
          </Link>
        </p>
      </div>
    </main>
  );
}
