import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv } from "../env";

let browserClient: SupabaseClient | null = null;

/** Shared browser client, or null when Supabase isn't configured (demo mode). */
export function getBrowserClient(): SupabaseClient | null {
  const env = publicSupabaseEnv();
  if (!env) return null;
  browserClient ??= createBrowserClient(env.url, env.publishableKey);
  return browserClient;
}
