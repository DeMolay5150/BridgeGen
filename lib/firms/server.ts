import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { decideFirm, type FirmAction, type FirmRole } from "../authz/policy";
import { getServerClient } from "../supabase/server";

const uuid = z.uuid();

/** The signed-in advisor and a client that acts as them (RLS applies). */
export async function signedIn(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  return userId ? { supabase, userId } : null;
}

export interface FirmAccess {
  supabase: SupabaseClient;
  firmId: string;
  userId: string;
  role: FirmRole;
}

/** The caller's membership of a firm, or null when they aren't in it (or it doesn't exist). */
export async function firmAccess(firmId: string): Promise<FirmAccess | null> {
  if (!uuid.safeParse(firmId).success) return null;
  const session = await signedIn();
  if (!session) return null;
  const { data } = await session.supabase
    .from("firm_members")
    .select("role")
    .eq("firm_id", firmId)
    .eq("user_id", session.userId)
    .maybeSingle<{ role: FirmRole }>();
  return data ? { ...session, firmId, role: data.role } : null;
}

/**
 * The caller's access when the firm policy allows `action`, else null.
 * Callers answer null with `notFound()`, so refusals don't reveal the firm.
 */
export async function authorizeFirm(firmId: string, action: FirmAction): Promise<FirmAccess | null> {
  const access = await firmAccess(firmId);
  return access && decideFirm(access.role, action) ? access : null;
}

/** Raised by the firm_members_keep_owner trigger. */
export const isLastOwnerError = (error: { message?: string } | null) =>
  !!error?.message?.includes("must keep at least one owner");
