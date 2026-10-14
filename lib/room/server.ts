import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "../env";
import { getAdminClient } from "../supabase/admin";
import { getServerClient } from "../supabase/server";
import { guardMutation, parseBody, rowsToResponses, type ParsedBody, type ResponseRow } from "./server-logic";
import { hashToken } from "./tokens";

export { parseBody, rowsToResponses };

/** JSON response that is never cached: these payloads are per-user or per-invite. */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** A uniform 404 so callers can't tell "doesn't exist" from "not yours". */
export const notFound = () => json({ error: "Not found" }, 404);

const uuid = z.uuid();

/**
 * Returns the company if the signed-in user may work on it: before the firms
 * migration, its owner; after it, any member of its firm. Access is decided
 * by RLS, so anyone else's select simply returns no row.
 */
export async function accessibleCompany(id: string): Promise<{ id: string; name: string } | null> {
  if (!uuid.safeParse(id).success) return null;
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("companies").select("id, name").eq("id", id).maybeSingle<{ id: string; name: string }>();
  return data ?? null;
}

/** The invite a raw token belongs to, looked up by its hash. */
export async function inviteForToken(token: string) {
  // Demo-only deployments have no invites: every link is simply not found.
  if (!isSupabaseConfigured()) return null;
  const { data } = await getAdminClient()
    .from("room_invites")
    .select("company_id, stakeholder")
    .eq("token_hash", hashToken(token))
    .maybeSingle<{ company_id: string; stakeholder: string }>();
  return data ?? null;
}

/** All responses for a company. Server-only: callers must already be authorized. */
export async function loadResponses(companyId: string) {
  const { data } = await getAdminClient()
    .from("room_responses")
    .select("stakeholder, positions, predictions, submitted")
    .eq("company_id", companyId)
    .returns<ResponseRow[]>();
  return rowsToResponses(data ?? []);
}

/**
 * Reads and validates a JSON body for a state-changing route: refuses
 * non-JSON and cross-origin requests, then oversized bodies before parsing.
 */
export async function readBody<T>(request: NextRequest, schema: z.ZodType<T>): Promise<ParsedBody<T>> {
  const refused = guardMutation(
    { contentType: request.headers.get("content-type"), origin: request.headers.get("origin") },
    [...new Set([request.nextUrl.origin, siteOrigin(request)])],
  );
  return refused ?? parseBody(await request.text(), schema);
}

/** Public origin for invite links. */
export function siteOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}
