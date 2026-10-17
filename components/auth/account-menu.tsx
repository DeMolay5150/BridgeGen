"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, Check, Loader2, LogOut, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isSupabaseConfigured } from "@/lib/env";
import { useSessionStore } from "@/lib/session/store";
import { useSimulatorStore } from "@/lib/simulator/store";
import { getBrowserClient } from "@/lib/supabase/client";

function SaveIndicator() {
  const status = useSessionStore((s) => s.saveStatus);
  const retry = useSessionStore((s) => s.retrySave);
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3 animate-spin" aria-hidden /> Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Check className="size-3 text-positive" aria-hidden /> Saved
      </span>
    );
  }
  if (status === "error") {
    return (
      <button type="button" onClick={() => retry?.()} className="flex items-center gap-1 text-xs text-critical" role="status">
        <AlertCircle className="size-3" aria-hidden /> Couldn&apos;t save — retry
      </button>
    );
  }
  return null;
}

/** Sign-in link, or the signed-in advisor's company, save state and account actions. */
export function AccountMenu() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const ready = useSessionStore((s) => s.ready);
  const companyName = useSimulatorStore((s) => s.companyName);

  // Demo-only deployment, or still checking the session: show nothing rather than flicker.
  if (!isSupabaseConfigured() || !ready) return null;

  if (!user) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/login" />}>
        Sign in
      </Button>
    );
  }

  const signOut = async () => {
    await getBrowserClient()?.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hidden sm:inline">
        <SaveIndicator />
      </span>
      <Popover>
        <PopoverTrigger
          render={<Button variant="ghost" size="sm" className="max-w-40 gap-1.5" aria-label="Account and company" />}
        >
          <UserRound data-icon="inline-start" />
          <span className="hidden truncate md:inline">{companyName ?? "Demo company"}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="grid gap-3 text-sm">
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Signed in as</span>
              <span className="truncate">{user.email}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Working on</span>
              <span className="truncate">{companyName ?? "Demo company (not saved)"}</span>
              <SaveIndicator />
            </div>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/companies" />}>
              <Building2 data-icon="inline-start" />
              Companies
            </Button>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/team" />}>
              <Users data-icon="inline-start" />
              Team
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
