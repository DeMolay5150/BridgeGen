import type { Metadata } from "next";
import { RedTeam } from "@/components/redteam/red-team";

export const metadata: Metadata = {
  title: "Red Team Mode — BridgeGen",
  description:
    "Stress-test a decision against founder incapacitation, successor exit and economic downturns, and find its breaking points.",
};

export default function RedTeamPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <RedTeam />
    </main>
  );
}
