import type { Metadata } from "next";
import { FlightSimulator } from "@/components/simulator/flight-simulator";

export const metadata: Metadata = {
  title: "Flight Simulator — BridgeGen",
  description:
    "Model debt leverage, equity transfer, valuation sensitivity and an outside CEO, and see the consequences instantly.",
};

export default function SimulatorPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <FlightSimulator />
    </main>
  );
}
