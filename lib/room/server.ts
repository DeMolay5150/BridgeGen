import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decide, type CompanyAction, type FirmRole, type Principal } from "../authz/policy";
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

export interface CompanyAccess {
  company: { id: string; name: string; ownerId: string | null; firmId: string | null };
  principal: Principal;
}

/** Postgres "undefined column": the firms migration hasn't been applied yet. */
const UNDEFINED_COLUMN = "42703";

/**
 * The company and the caller's standing on it, or null when they can't see it.
 * Visibility is decided by RLS (before the firms migration, owner-only; after
 * it, firm members); the firm role then feeds `decide()` for finer actions.
 */
export async function companyAccess(id: string): Promise<CompanyAccess | null> {
  if (!uuid.safeParse(id).success) return null;
  const supabase = await getServerClient();
  if (!supabase) return null;
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  type Row = { id: string; name: string; owner_id: string | null; firm_id?: string };
  const withFirm = await supabase.from("companies").select("id, name, owner_id, firm_id").eq("id", id).maybeSingle<Row>();
  if (withFirm.error?.code === UNDEFINED_COLUMN) {
    // Pre-firms schema: RLS only shows a company to its owner.
    const { data } = await supabase.from("companies").select("id, name, owner_id").eq("id", id).maybeSingle<Row>();
    if (!data) return null;
    return { company: { id: data.id, name: data.name, ownerId: data.owner_id, firmId: null }, principal: { id: userId, firmRole: "owner" } };
  }
  const row = withFirm.data;
  if (!row?.firm_id) return null;
  const { data: membership } = await supabase
    .from("firm_members")
    .select("role")
    .eq("firm_id", row.firm_id)
    .eq("user_id", userId)
    .maybeSingle<{ role: FirmRole }>();
  return {
    company: { id: row.id, name: row.name, ownerId: row.owner_id, firmId: row.firm_id },
    principal: { id: userId, firmRole: membership?.role ?? null },
  };
}

/** The policy decision for one action on an accessible company. */
export const allows = (access: CompanyAccess, action: CompanyAction) =>
  decide(access.principal, { kind: "company", ownerId: access.company.ownerId }, action);

/**
 * The company's access context when the caller may perform `action`, else
 * null. Callers answer null with `notFound()`, so a refusal never reveals
 * that the company exists.
 */
export async function authorize(id: string, action: CompanyAction): Promise<CompanyAccess | null> {
  const access = await companyAccess(id);
  return access && allows(access, action).allowed ? access : null;
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
