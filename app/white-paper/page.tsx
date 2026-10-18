import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { renderPaper } from "@/lib/white-paper";

export const metadata: Metadata = {
  title: "White paper — BridgeGen",
  description:
    "How BridgeGen is built: ten open-source reference patterns, a secure multi-tenant firm architecture and a layered Supabase security model.",
};

// docs/white-paper.md is the single source; read once at build (a predictable value, so it prerenders).
const paper = renderPaper(readFileSync(path.join(process.cwd(), "docs", "white-paper.md"), "utf8"));

export default function WhitePaperPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-10 grid max-w-3xl gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">White paper</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">{paper.title}</h1>
        <p className="text-muted-foreground">
          The patterns, tenancy model and security layers behind BridgeGen, including what is still open.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-20 grid gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Contents</p>
            <ol className="grid gap-1.5 text-sm">
              {paper.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-muted-foreground transition-colors hover:text-white">
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="min-w-0">
          {/* Trusted HTML: rendered from our own committed Markdown, never from user input. */}
          <article className="paper-prose max-w-3xl" dangerouslySetInnerHTML={{ __html: paper.html }} />
          <div className="mt-12 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/simulator" />}>
              Run a simulation
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/walkthrough" />}>
              Watch the walkthrough
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
