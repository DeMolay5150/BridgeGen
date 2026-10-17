import type { NextRequest } from "next/server";
import { invitableRoles } from "@/lib/authz/policy";
import { recordAudit } from "@/lib/audit/server";
import { FIRM_INVITE_DAYS, firmInviteBodySchema } from "@/lib/firms/schema";
import { authorizeFirm } from "@/lib/firms/server";
import { json, notFound, readBody, siteOrigin } from "@/lib/room/server";
import { generateToken, hashToken } from "@/lib/room/tokens";

/**
 * Invites a colleague by email. The raw link is returned once and never
 * stored; inviting the same address again replaces (and disables) the old link.
 * Nothing here reveals whether the address already has an account.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/firms/[id]/invites">) {
  const { id } = await ctx.params;
  const access = await authorizeFirm(id, "members:invite");
  if (!access) return notFound();
  const body = await readBody(request, firmInviteBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);
  const { email, role } = body.data;
  if (!invitableRoles(access.role).includes(role)) return json({ error: "Invitations can offer admin or member." }, 403);

  // Colleagues' addresses are already visible to the inviter through the roster.
  const { data: roster } = await access.supabase.rpc("firm_roster", { target: id });
  if ((roster as { email: string }[] | null)?.some((m) => m.email.toLowerCase() === email)) return json({ error: `${email} is already in this firm.` }, 409);

  const token = generateToken();
  const now = new Date();
  const { data, error } = await access.supabase
    .from("firm_invites")
    .upsert(
      {
        firm_id: id,
        email,
        role,
        token_hash: hashToken(token),
        invited_by: access.userId,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + FIRM_INVITE_DAYS * 86_400_000).toISOString(),
      },
      { onConflict: "firm_id,email" },
    )
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return json({ error: "Couldn't create the invitation" }, 500);

  await recordAudit({ firmId: id, actorId: access.userId, action: "firm.member_invited", metadata: { email, role } });
  return json({ id: data.id, url: `${siteOrigin(request)}/join/${token}` }, 201);
}
