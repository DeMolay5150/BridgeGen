import { Suspense } from "react";
import type { Metadata } from "next";
import { RespondForm } from "@/components/room/respond-form";

export const metadata: Metadata = {
  title: "Your private questionnaire — BridgeGen",
  // Invite links are credentials: keep them out of search engines and Referer headers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Respond({ params }: { params: PageProps<"/respond/[token]">["params"] }) {
  const { token } = await params;
  return <RespondForm token={token} />;
}

export default function RespondPage({ params }: PageProps<"/respond/[token]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:py-14">
      {/* The token is only known at request time, so it resolves inside Suspense. */}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Opening your questionnaire…</p>}>
        <Respond params={params} />
      </Suspense>
    </main>
  );
}
