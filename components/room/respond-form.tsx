"use client";

import { useEffect, useState } from "react";
import { applyResponsePatch } from "@/lib/room/response";
import type { RoomResponse } from "@/lib/room/types";
import { QuestionnaireForm } from "./questionnaire";

interface Invite {
  companyName: string;
  /** "the Founder", or an heir's name. */
  stakeholderLabel: string;
  targetLabel: string;
  response: RoomResponse;
}

type LoadState = { status: "loading" } | { status: "invalid" } | { status: "ready"; invite: Invite };

/** A stakeholder's private questionnaire, opened from their invite link. */
export function RespondForm({ token }: { token: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [response, setResponse] = useState<RoomResponse | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/respond/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json()) as Invite) : null))
      .catch(() => null)
      .then((invite) => {
        if (cancelled) return;
        if (!invite) setLoad({ status: "invalid" });
        else {
          setLoad({ status: "ready", invite });
          setResponse(invite.response);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  /** Answers stay on this device until submitted; submitting or reopening for edits saves to the server. */
  const change = async (patch: Partial<RoomResponse>) => {
    const next = applyResponsePatch(response, patch);
    setResponse(next);
    setError(null);
    if (!("submitted" in patch)) return;
    setBusy(true);
    const res = await fetch(`/api/respond/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setResponse(applyResponsePatch(next, { submitted: !next.submitted }));
      setError("Couldn't save. Check your connection and try again.");
    }
  };

  if (load.status === "loading") return <p className="text-sm text-muted-foreground">Opening your questionnaire…</p>;
  if (load.status === "invalid") {
    return (
      <p role="alert" className="rounded-lg bg-critical/10 px-4 py-3 text-sm text-critical">
        This link isn&apos;t valid. It may have been replaced by a newer one; ask your advisor for a fresh link.
      </p>
    );
  }

  const { invite } = load;
  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-metric">Decision Room · {invite.companyName}</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-white">
          Your private view, as {invite.stakeholderLabel}
        </h1>
      </header>
      <QuestionnaireForm
        targetLabel={invite.targetLabel}
        response={response}
        onChange={(patch) => void change(patch)}
        busy={busy}
        description="Your answers are confidential. Your advisor never sees them; they only see where the family's views diverge, never who said what."
        submittedMessage="Thank you. Your answers are saved and confidential. You can close this page."
      />
      {error && <p role="alert" className="text-sm text-critical">{error}</p>}
    </div>
  );
}
