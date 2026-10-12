import type { Metadata } from "next";
import { ForkTheFuture } from "@/components/fork/fork-the-future";

export const metadata: Metadata = {
  title: "Fork the Future — BridgeGen",
  description:
    "Compare two decisions side by side across 1, 3, 5 and 10-year horizons.",
};

export default function ForkPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <ForkTheFuture />
    </main>
  );
}
