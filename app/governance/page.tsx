import type { Metadata } from "next";
import { GovernanceCalculator } from "@/components/governance/governance-calculator";

export const metadata: Metadata = {
  title: "Governance Debt — BridgeGen",
  description:
    "Quantify undocumented authority, missing board seats and informal voting rules as Value at Risk.",
};

export default function GovernancePage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <GovernanceCalculator />
    </main>
  );
}
