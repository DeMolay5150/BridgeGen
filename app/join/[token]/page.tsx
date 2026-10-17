import { Suspense } from "react";
import type { Metadata } from "next";
import { JoinFirm } from "@/components/firm/join-firm";

export const metadata: Metadata = {
  title: "Join a firm — BridgeGen",
  // Invitation links are credentials: keep them out of search engines and Referer headers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Join({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  const { token } = await params;
  return <JoinFirm token={token} />;
}

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 md:py-14">
      {/* The token is only known at request time, so it resolves inside Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your invitation…</p>}>
        <Join params={params} />
      </Suspense>
    </main>
  );
}
