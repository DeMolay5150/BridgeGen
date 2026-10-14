import type { Metadata } from "next";
import { Presentation } from "@/components/present/presentation";

export const metadata: Metadata = {
  title: "Client session — BridgeGen",
  description: "Full-screen, client-safe view of the scenario for live meetings.",
};

export default function PresentPage() {
  return <Presentation />;
}
