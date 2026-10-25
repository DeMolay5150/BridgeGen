import type { NextRequest } from "next/server";
import { inviteBodySchema } from "@/lib/room/schema";
import { recordAudit } from "@/lib/audit/server";
import { allows, authorize, json, loadResponses, notFound, readBody, siteOrigin } from "@/lib/room/server";
import { generateToken, hashToken } from "@/lib/room/tokens";
import { STAKEHOLDER_IDS } from "@/lib/simulator/alignment";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

/** Invite status per stakeholder: whether a link exists and whether they've submitted. Never answers. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/companies/[id]/invites">) {
  const { id } = await ctx.params;
  const access = await authorize(id, "room:view_gaps");
  if (!access) return notFound();
  const { company } = access;

  const supabase = (await getServerClient())!;
  const { data: invites } = await supabase
    .from("room_invites")
    .select("stakeholder, created_at")
    .eq("company_id", company.id)
    .returns<{ stakeholder: string; created_at: string }[]>();
  const responses = await loadResponses(company.id);

  return json({
    stakeholders: STAKEHOLDER_IDS.map((stakeholder) => ({
      stakeholder,
      invitedAt: invites?.find((i) => i.stakeholder === stakeholder)?.created_at ?? null,
      submitted: responses[stakeholder]?.submitted === true,
    })),
  });
}

/** Creates (or replaces) a stakeholder's private link. The raw token is returned once and never stored. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/companies/[id]/invites">) {
  const { id } = await ctx.params;
  const access = await authorize(id, "room:invite");
  if (!access) return notFound();
  const { company } = access;

  const body = await readBody(request, inviteBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  const supabase = (await getServerClient())!;
  // Replacing a link disables the one already sent, which is a bigger call than issuing the first.
  const { data: existing } = await supabase
    .from("room_invites")
    .select("stakeholder")
    .eq("company_id", company.id)
    .eq("stakeholder", body.data.stakeholder)
    .maybeSingle();
  if (existing && !allows(access, "room:rotate_invite").allowed) {
    return json(
      { error: "Only the firm's owners and admins, or whoever created this company, can replace a link that's already been sent." },
      403,
    );
  }

  const token = generateToken();
  // Links are server-issued: this write uses the secret key, after authorize()
  // above (migration 20261025100000_write_hardening revokes signed-in users'
  // direct writes). Replacing the hash invalidates the old link.
  const { error } = await getAdminClient()
    .from("room_invites")
    .upsert(
      { company_id: company.id, stakeholder: body.data.stakeholder, token_hash: hashToken(token) },
      { onConflict: "company_id,stakeholder" },
    );
  if (error) return json({ error: "Couldn't create the link" }, 500);

  await recordAudit({
    companyId: company.id,
    actorId: access.principal.id,
    action: existing ? "room.invite_rotated" : "room.invite_created",
    metadata: { stakeholder: body.data.stakeholder },
  });

  return json({ url: `${siteOrigin(request)}/respond/${token}` }, 201);
}
