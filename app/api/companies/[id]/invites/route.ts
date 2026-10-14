import type { NextRequest } from "next/server";
import { inviteBodySchema } from "@/lib/room/schema";
import { json, loadResponses, notFound, accessibleCompany, readBody, siteOrigin } from "@/lib/room/server";
import { generateToken, hashToken } from "@/lib/room/tokens";
import { STAKEHOLDER_IDS } from "@/lib/simulator/alignment";
import { getServerClient } from "@/lib/supabase/server";

/** Invite status per stakeholder: whether a link exists and whether they've submitted. Never answers. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/companies/[id]/invites">) {
  const { id } = await ctx.params;
  const company = await accessibleCompany(id);
  if (!company) return notFound();

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
  const company = await accessibleCompany(id);
  if (!company) return notFound();

  const body = await readBody(request, inviteBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  const token = generateToken();
  const supabase = (await getServerClient())!;
  // RLS (firm members only) applies to this write; replacing the hash invalidates the old link.
  const { error } = await supabase
    .from("room_invites")
    .upsert(
      { company_id: company.id, stakeholder: body.data.stakeholder, token_hash: hashToken(token), created_at: new Date().toISOString() },
      { onConflict: "company_id,stakeholder" },
    );
  if (error) return json({ error: "Couldn't create the link" }, 500);

  return json({ url: `${siteOrigin(request)}/respond/${token}` }, 201);
}
