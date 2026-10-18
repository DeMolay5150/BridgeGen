import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WalkthroughPlayer } from "@/components/walkthrough/walkthrough-player";
import { publicSupabaseEnv } from "@/lib/env";
import { salesHref } from "@/lib/pricing/plans";
import { WALKTHROUGH_CHAPTERS, walkthroughSources } from "@/lib/walkthrough";

export const metadata: Metadata = {
  title: "Walkthrough — BridgeGen",
  description: "Three minutes on BridgeGen: model a recap, stress-test it, and take it to committee.",
};

export default function WalkthroughPage() {
  // Supabase Storage when configured; otherwise the local render in public/.
  const sources = walkthroughSources(publicSupabaseEnv()?.url);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8 grid max-w-3xl gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Walkthrough</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">
          See the consequences before the client signs
        </h1>
        <p className="text-muted-foreground">
          Three minutes for M&amp;A bankers and fractional CFOs: model a dividend recap, stress-test it against the
          family, the lender and the market, and take it to committee. Every figure is the demo company run through the
          same engines as the app. The narration is on screen, so it plays fine muted.
        </p>
      </header>

      <WalkthroughPlayer sources={sources} chapters={WALKTHROUGH_CHAPTERS} />

      <div className="mt-10 flex flex-wrap gap-3">
        <Button size="lg" nativeButton={false} render={<Link href="/simulator" />}>
          Try it on the demo company
        </Button>
        <Button size="lg" variant="outline" nativeButton={false} render={<a href={salesHref()} />}>
          Book a partnership call
        </Button>
      </div>
    </main>
  );
}
