"use client";

import { useState } from "react";
import { Check, Copy, Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createInvite, type InviteStatus } from "@/lib/room/use-room-api";
import { STAKEHOLDER_LABELS, type StakeholderId } from "@/lib/simulator/alignment";

const dateLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));

/** Saved-company mode: the stakeholder answers privately on their own device via a link. */
export function InvitePanel({
  companyId,
  stakeholder,
  status,
  onChanged,
}: {
  companyId: string;
  stakeholder: StakeholderId;
  status: InviteStatus | undefined;
  onChanged: () => void;
}) {
  const label = STAKEHOLDER_LABELS[stakeholder];
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(false);
    const link = await createInvite(companyId, stakeholder);
    setBusy(false);
    if (link) {
      setUrl(link);
      setCopied(false);
      onChanged();
    } else setError(true);
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground" aria-hidden />
          Private questionnaire
        </CardTitle>
        <CardDescription>
          Send the {label} a private link. They answer on their own device; you&apos;ll only ever see
          where views diverge, never their answers.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Link</dt>
            <dd>{status?.invitedAt ? `Created ${dateLabel(status.invitedAt)}` : "Not sent yet"}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">Answers</dt>
            <dd className={status?.submitted ? "text-positive" : "text-muted-foreground"}>
              {status?.submitted ? "Submitted" : "Waiting"}
            </dd>
          </div>
        </dl>

        {url && (
          <div className="grid gap-2 rounded-lg border border-border p-3">
            <span className="text-xs text-muted-foreground">
              Copy this link now: it won&apos;t be shown again. Anyone with it can answer as the {label}.
            </span>
            <div className="flex gap-2">
              <Input readOnly value={url} aria-label={`Private link for the ${label}`} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" size="sm" onClick={copy}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}

        <Button variant={status?.invitedAt ? "outline" : "default"} className="w-fit" disabled={busy} onClick={generate}>
          <Link2 data-icon="inline-start" />
          {busy ? "Creating…" : status?.invitedAt ? "Replace link" : "Create private link"}
        </Button>
        {status?.invitedAt && !url && (
          <p className="text-xs text-muted-foreground">Replacing the link disables the old one. Answers already given are kept.</p>
        )}
        {error && <p role="alert" className="text-xs text-critical">Couldn&apos;t create the link. Try again.</p>}
      </CardContent>
    </Card>
  );
}
