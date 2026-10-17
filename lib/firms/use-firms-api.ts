"use client";

import { useCallback, useEffect, useState } from "react";
import type { FirmRole } from "../authz/policy";
import type { FirmDetail, FirmSummary, InvitePreview } from "./schema";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** JSON request to our own API; refusals carry the server's reason. */
async function call<T>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, status: 0, error: "Network error. Check your connection and try again." };
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  return res.ok ? { ok: true, data: json } : { ok: false, status: res.status, error: json.error ?? "Something went wrong." };
}

/** Loads a JSON endpoint, re-fetching on demand. Null url = nothing to load. */
function useResource<T>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; result: ApiResult<T> | null }>({ url: null, result: null });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void call<T>(url).then((result) => {
      if (!cancelled) setState({ url, result });
    });
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  // A result for a different url (the firm just switched) is stale: show loading instead.
  return { result: state.url === url ? state.result : null, refresh };
}

export const useFirms = (enabled: boolean) => {
  const { result, refresh } = useResource<{ firms: FirmSummary[] }>(enabled ? "/api/firms" : null);
  return { firms: result?.ok ? result.data.firms : null, error: result && !result.ok ? result.error : null, refresh };
};

export const useFirm = (firmId: string | null) => {
  const { result, refresh } = useResource<FirmDetail>(firmId ? `/api/firms/${firmId}` : null);
  return { detail: result?.ok ? result.data : null, error: result && !result.ok ? result.error : null, refresh };
};

export const createFirm = (name: string) => call<{ firm: FirmSummary }>("/api/firms", "POST", { name });
export const renameFirm = (firmId: string, name: string) => call<{ ok: true }>(`/api/firms/${firmId}`, "PATCH", { name });
export const inviteMember = (firmId: string, email: string, role: FirmRole) =>
  call<{ id: string; url: string }>(`/api/firms/${firmId}/invites`, "POST", { email, role });
export const revokeInvite = (firmId: string, inviteId: string) => call<{ ok: true }>(`/api/firms/${firmId}/invites/${inviteId}`, "DELETE");
export const changeRole = (firmId: string, userId: string, role: FirmRole) =>
  call<{ ok: true }>(`/api/firms/${firmId}/members/${userId}`, "PATCH", { role });
export const removeMember = (firmId: string, userId: string) => call<{ ok: true }>(`/api/firms/${firmId}/members/${userId}`, "DELETE");
export const previewInvite = (token: string) => call<InvitePreview>("/api/firm-invites/preview", "POST", { token });
export const acceptInvite = (token: string) => call<{ firmId: string }>("/api/firm-invites/accept", "POST", { token });
