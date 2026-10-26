"use client";

import { useCallback, useEffect, useState } from "react";
import type { SeatId } from "./seats";
import type { RoomGaps } from "./types";

export interface InviteStatus {
  stakeholder: SeatId;
  invitedAt: string | null;
  submitted: boolean;
}

const POLL_MS = 15_000;

/**
 * Fetches a JSON endpoint for the open company, re-fetching on demand and
 * every 15 seconds while mounted. Null company = nothing to fetch (demo mode).
 */
function usePolled<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const load = () =>
      fetch(url, { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<T>) : Promise.reject(new Error(String(res.status)))))
        .then((body) => {
          if (cancelled) return;
          setData(body);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url, version]);

  return { data, error, refresh };
}

export function useRoomGaps(companyId: string | null) {
  return usePolled<RoomGaps>(companyId ? `/api/companies/${companyId}/gaps` : null);
}

export function useInviteStatus(companyId: string | null) {
  const result = usePolled<{ stakeholders: InviteStatus[] }>(companyId ? `/api/companies/${companyId}/invites` : null);
  return { ...result, data: result.data?.stakeholders ?? null };
}

/** Creates or replaces a stakeholder's private link. The URL is shown once; refusals carry the server's reason. */
export async function createInvite(
  companyId: string,
  stakeholder: SeatId,
): Promise<{ url: string } | { error: string }> {
  const res = await fetch(`/api/companies/${companyId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stakeholder }),
  }).catch(() => null);
  const body = res ? ((await res.json().catch(() => ({}))) as { url?: string; error?: string }) : {};
  if (res?.ok && body.url) return { url: body.url };
  return { error: res?.status === 403 && body.error ? body.error : "Couldn't create the link. Try again." };
}

/** Tells the audit trail about a client-side export. Best effort: never blocks or fails the export. */
export function reportExport(
  companyId: string | null,
  action: "report.exported" | "deck.exported",
  format: "pdf" | "pptx" | "md",
) {
  if (!companyId) return;
  void fetch(`/api/companies/${companyId}/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, format }),
  }).catch(() => undefined);
}
