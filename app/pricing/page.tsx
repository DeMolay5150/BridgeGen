import type { Metadata } from "next";
import Link from "next/link";
import { EyeOff, Lightbulb, Link2, ShieldCheck } from "lucide-react";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { PlanCards } from "@/components/pricing/plan-cards";
import { RoiCalculator } from "@/components/pricing/roi-calculator";
import { Button } from "@/components/ui/button";
import { FAQ, TRIAL_HREF } from "@/lib/pricing/plans";

export const metadata: Metadata = {
  title: "Pricing — BridgeGen",
  description:
    "Every module, every explanation, and confidential Decision Rooms, priced at a fraction of one engagement.",
};

const TRUST = [
  { icon: Link2, text: "Stakeholders answer through private links, with no account needed." },
  { icon: EyeOff, text: "Their answers are stored server-side and never shown to the advisor; you see only where views diverge." },
  { icon: Lightbulb, text: "Every number has an Explain card: traceable rules, no AI-generated figures." },
  { icon: ShieldCheck, text: "Your client companies are visible only to your account, enforced by row-level security in the database." },
];

function Ctas() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button size="lg" nativeButton={false} render={<Link href={TRIAL_HREF} />}>
        Start a 14-day trial
      </Button>
      <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/simulator" />}>
        Explore the live demo
      </Button>
    </div>
  );
}

function SectionHeading({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-3 text-center">
      <h2 id={id} className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
        {title}
      </h2>
      {children && <p className="text-muted-foreground">{children}</p>}
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-24 px-4 py-16 md:px-8 md:py-24">
      {/* 10.1 Hero */}
      <section className="mx-auto grid max-w-3xl gap-6 text-center" aria-labelledby="pricing-heading">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Pricing</p>
        <h1 id="pricing-heading" className="font-heading text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Pricing for advisors who change what owners decide.
        </h1>
        <p className="text-lg text-muted-foreground">
          Every module, every explanation, and confidential Decision Rooms, priced at a fraction of one engagement.
        </p>
        <Ctas />
        <p className="text-xs text-muted-foreground">The live demo needs no sign-up.</p>
      </section>

      {/* 10.2 Plan cards */}
      <section aria-label="Plans">
        <PlanCards />
      </section>

      {/* 10.3 ROI */}
      <section className="grid gap-8" aria-labelledby="roi-heading">
        <SectionHeading id="roi-heading" title="The arithmetic is simple.">
          If BridgeGen helps you win or keep one owner engagement a year, Solo pays for itself about ten times
          over. In our demo company, one stress test reveals $21.2M of avoidable loss. Your clients&apos; numbers
          will differ; the conversation it starts won&apos;t.
        </SectionHeading>
        <div className="mx-auto w-full max-w-4xl">
          <RoiCalculator />
        </div>
      </section>

      {/* 10.4 Comparison */}
      <section className="grid gap-8" aria-labelledby="compare-heading">
        <SectionHeading id="compare-heading" title="Compare plans" />
        <ComparisonTable />
      </section>

      {/* 10.5 Confidentiality and trust */}
      <section className="grid gap-8" aria-labelledby="trust-heading">
        <SectionHeading id="trust-heading" title="Built for conversations families don't have out loud." />
        <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 rounded-xl border border-border bg-card p-5 text-sm">
              <Icon className="mt-0.5 size-5 shrink-0 text-metric" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 10.6 FAQ */}
      <section className="grid gap-8" aria-labelledby="faq-heading">
        <SectionHeading id="faq-heading" title="Questions" />
        <div className="mx-auto grid w-full max-w-3xl divide-y divide-border border-y border-border">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 10.7 Closing CTA */}
      <section className="grid gap-6 rounded-2xl border border-border bg-card px-6 py-12 text-center" aria-labelledby="cta-heading">
        <h2 id="cta-heading" className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Show your next client the consequences before they decide.
        </h2>
        <Ctas />
      </section>

      {/* 10.8 Disclaimer */}
      <footer className="mx-auto max-w-3xl text-center text-xs leading-5 text-muted-foreground">
        BridgeGen is a decision-support and illustration tool. Outputs are scenario estimates based on user
        inputs and stated assumptions; they are not valuations, guarantees, or legal, tax or investment advice.
        Projections are undiscounted and illustrative.
      </footer>
    </main>
  );
}
