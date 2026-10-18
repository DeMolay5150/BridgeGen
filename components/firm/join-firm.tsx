"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { roleWithArticle, type InvitePreview } from "@/lib/firms/schema";
import { acceptInvite, previewInvite, type ApiResult } from "@/lib/firms/use-firms-api";
import { useSessionStore } from "@/lib/session/store";
import { getBrowserClient } from "@/lib/supabase/client";

function Notice({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </CardTitle>
        {children && <CardDescription>{children}</CardDescription>}
      </CardHeader>
      {action && <CardContent className="flex flex-wrap gap-2">{action}</CardContent>}
    </Card>
  );
}

/** Accepts a firm invitation for the signed-in advisor, after showing what it offers. */
export function JoinFirm({ token }: { token: string }) {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const ready = useSessionStore((s) => s.ready);
  const [preview, setPreview] = useState<{ userId: string; result: ApiResult<InvitePreview> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void previewInvite(token).then((result) => {
      if (!cancelled) setPreview({ userId, result });
    });
    return () => {
      cancelled = true;
    };
  }, [token, userId]);

  if (!isSupabaseConfigured()) return <Notice title="Accounts aren't set up on this deployment" />;
  if (!ready) return <p className="text-sm text-muted-foreground">Checking your invitation…</p>;

  const signInHref = `/login?next=${encodeURIComponent(`/join/${token}`)}`;
  if (!user) {
    return (
      <Notice
        title="You've been invited to join a firm on BridgeGen"
        action={<Button nativeButton={false} render={<Link href={signInHref} />}>Sign in or create an account</Button>}
      >
        Sign in, or create an account, with the email address the invitation was sent to. You&apos;ll come straight back here.
      </Notice>
    );
  }

  const current = preview?.userId === user.id ? preview.result : null;
  if (!current) return <p className="text-sm text-muted-foreground">Checking your invitation…</p>;
  if (!current.ok) {
    return (
      <Notice title="This invitation isn't valid" action={<Button variant="outline" nativeButton={false} render={<Link href="/companies" />}>Go to your companies</Button>}>
        It may have been used, revoked or replaced by a newer link. Ask whoever invited you to send a fresh one.
      </Notice>
    );
  }

  const invite = current.data;
  if (invite.alreadyMember) {
    return (
      <Notice title={`You're already in ${invite.firmName}`} action={<Button nativeButton={false} render={<Link href="/team" />}>Open your team</Button>} />
    );
  }
  if (invite.expired) {
    return <Notice title="This invitation has expired">Ask whoever invited you to {invite.firmName} to send a fresh link.</Notice>;
  }
  if (!invite.emailMatches) {
    const switchAccount = async () => {
      await getBrowserClient()?.auth.signOut();
      router.push(signInHref);
      router.refresh();
    };
    return (
      <Notice title="This invitation was sent to a different email address" action={<Button variant="outline" onClick={switchAccount}>Sign in with another account</Button>}>
        You&apos;re signed in as {user.email}. Sign in with the address the invitation to {invite.firmName} was sent to. If you&apos;ve
        just created that account, confirm the email first.
      </Notice>
    );
  }

  const accept = async () => {
    setBusy(true);
    setError(null);
    const result = await acceptInvite(token);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(`/team?firm=${result.data.firmId}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden />
          Join {invite.firmName}
        </CardTitle>
        <CardDescription>
          You&apos;ll join as {roleWithArticle(invite.role)} and can open and edit the firm&apos;s
          client companies{invite.role === "admin" ? ", and invite and manage colleagues" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error && <p role="alert" className="rounded-lg bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={accept} disabled={busy}>{busy ? "Joining…" : `Join ${invite.firmName}`}</Button>
          <Button variant="ghost" nativeButton={false} render={<Link href="/companies" />}>Not now</Button>
        </div>
      </CardContent>
    </Card>
  );
}
