"use client";

import { useCallback, useEffect, useState } from "react";
import type { StakeholderId } from "../simulator/alignment";
import type { RoomGaps } from "./types";

export interface InviteStatus {
  stakeholder: StakeholderId;
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

/** Creates or replaces a stakeholder's private link; returns the URL (shown once) or null on failure. */
export async function createInvite(companyId: string, stakeholder: StakeholderId): Promise<string | null> {
  const res = await fetch(`/api/companies/${companyId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stakeholder }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as { url?: string };
  return body.url ?? null;
}
