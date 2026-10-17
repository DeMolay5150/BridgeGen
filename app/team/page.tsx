import type { Metadata } from "next";
import { TeamSettings } from "@/components/firm/team-settings";

export const metadata: Metadata = {
  title: "Team — BridgeGen",
  description: "Your firm's members, roles and invitations.",
};

export default function TeamPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8 grid gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Team</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white md:text-3xl">Firm &amp; colleagues</h1>
      </header>
      <TeamSettings />
    </main>
  );
}
