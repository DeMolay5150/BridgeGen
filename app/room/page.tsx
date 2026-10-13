import type { Metadata } from "next";
import { DecisionRoom } from "@/components/room/decision-room";

export const metadata: Metadata = {
  title: "Decision Room — BridgeGen",
  description:
    "Founder, heir, board and lender views of one decision, with confidential perception gap detection.",
};

export default function RoomPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <DecisionRoom />
    </main>
  );
}
