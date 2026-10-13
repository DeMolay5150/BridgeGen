"use client";

import { useEffect } from "react";
import { fromRow, toRow, type CompanyRow } from "@/lib/persistence/serialize";
import { ACTIVE_COMPANY_KEY, COMPANY_COLUMNS, useSessionStore } from "@/lib/session/store";
import { selectSnapshot, useSimulatorStore } from "@/lib/simulator/store";
import { getBrowserClient } from "@/lib/supabase/client";

const SAVE_DELAY_MS = 1_000;

function remember(companyId: string | null) {
  try {
    if (companyId) localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    else localStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch {
    // Storage unavailable (private mode): the company just won't reopen after a reload.
  }
}

function remembered(): string | null {
  try {
    return localStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

/**
 * Keeps the client in sync with Supabase: tracks the signed-in user, reopens
 * the last company after a reload, and autosaves edits to the open company.
 * Renders nothing. A no-op when Supabase isn't configured.
 */
export function SessionSync() {
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      useSessionStore.setState({ ready: true });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // JSON of the last snapshot known to be in the database, per company.
    let saved: { companyId: string; json: string } | null = null;
    // An edit waiting out the debounce.
    let pending: { companyId: string; json: string; row: ReturnType<typeof toRow> } | null = null;

    const save = async (companyId: string, json: string, row: ReturnType<typeof toRow>) => {
      pending = null;
      useSessionStore.setState({ saveStatus: "saving", retrySave: null });
      const { error } = await supabase.from("companies").update(row).eq("id", companyId);
      if (cancelled) return;
      if (error) {
        useSessionStore.setState({ saveStatus: "error", retrySave: () => void save(companyId, json, row) });
      } else {
        saved = { companyId, json };
        useSessionStore.setState({ saveStatus: "saved", retrySave: null });
      }
    };

    const unsubscribeStore = useSimulatorStore.subscribe((state, prev) => {
      if (state.companyId !== prev.companyId) {
        remember(state.companyId);
        clearTimeout(timer);
        // Flush the previous company's last edit rather than dropping it.
        if (pending) void save(pending.companyId, pending.json, pending.row);
        // A freshly loaded company is already in the database: don't save it straight back.
        saved = state.companyId ? { companyId: state.companyId, json: JSON.stringify(toRow(selectSnapshot(state))) } : null;
        useSessionStore.setState({ saveStatus: "idle", retrySave: null });
        return;
      }
      const companyId = state.companyId;
      if (!companyId) return;
      const row = toRow(selectSnapshot(state));
      const json = JSON.stringify(row);
      if (saved?.companyId === companyId && saved.json === json) return;
      clearTimeout(timer);
      pending = { companyId, json, row };
      timer = setTimeout(() => void save(companyId, json, row), SAVE_DELAY_MS);
    });

    const reopenRememberedCompany = async () => {
      const id = remembered();
      if (!id || useSimulatorStore.getState().companyId) return;
      const { data, error } = await supabase.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle<CompanyRow>();
      if (cancelled) return;
      if (error || !data) {
        remember(null);
        return;
      }
      useSimulatorStore.getState().loadCompany({ id: data.id, name: data.name, snapshot: fromRow(data) });
    };

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      useSessionStore.setState({ user: data.user, ready: true });
      if (data.user) void reopenRememberedCompany();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      useSessionStore.setState({ user: session?.user ?? null, ready: true });
      if (event === "SIGNED_OUT") useSimulatorStore.getState().exitToDemo();
    });

    return () => {
      clearTimeout(timer);
      if (pending) void save(pending.companyId, pending.json, pending.row);
      cancelled = true;
      unsubscribeStore();
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
