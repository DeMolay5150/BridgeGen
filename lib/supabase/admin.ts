import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, supabaseSecretKey } from "../env";

/**
 * Secret-key client that bypasses RLS. Use only in route handlers, and only
 * after the caller has been authorized (owner check or invite token).
 */
export function getAdminClient(): SupabaseClient {
  const env = publicSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured.");
  return createClient(env.url, supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
