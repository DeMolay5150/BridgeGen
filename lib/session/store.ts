import type { User } from "@supabase/supabase-js";
import { create } from "zustand";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SessionState {
  /** Signed-in advisor, or null (signed out or Supabase not configured). */
  user: User | null;
  /** False until the first auth check finishes, to avoid flashing "Sign in". */
  ready: boolean;
  saveStatus: SaveStatus;
  /** Retries the last failed save, when there is one. */
  retrySave: (() => void) | null;
}

/** Written only by `components/session-sync.tsx`; read anywhere. */
export const useSessionStore = create<SessionState>()(() => ({
  user: null,
  ready: false,
  saveStatus: "idle",
  retrySave: null,
}));

/** localStorage key remembering which company to reopen after a reload. */
export const ACTIVE_COMPANY_KEY = "bridgegen.activeCompanyId";

/** Columns needed to open a company. */
export const COMPANY_COLUMNS = "id, name, baseline, scenario, governance, fork, priorities, updated_at";
