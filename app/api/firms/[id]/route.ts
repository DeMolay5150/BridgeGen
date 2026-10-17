import type { NextRequest } from "next/server";
import { decideFirm, type FirmRole } from "@/lib/authz/policy";
import { recordAudit } from "@/lib/audit/server";
import { firmNameBodySchema, type FirmDetail, type FirmInvite, type FirmMember } from "@/lib/firms/schema";
import { authorizeFirm } from "@/lib/firms/server";
import { json, notFound, readBody } from "@/lib/room/server";

type RosterRow = { user_id: string; email: string; role: FirmRole; joined_at: string };
type InviteRow = { id: string; email: string; role: FirmRole; created_at: string; expires_at: string };

/** The firm, its roster (with emails, via firm_roster()) and, for owners and admins, pending invitations. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/firms/[id]">) {
  const { id } = await ctx.params;
  const access = await authorizeFirm(id, "firm:view");
  if (!access) return notFound();
  const { supabase } = access;

  const [firm, roster] = await Promise.all([
    supabase.from("firms").select("id, name").eq("id", id).single<{ id: string; name: string }>(),
    supabase.rpc("firm_roster", { target: id }),
  ]);
  if (firm.error || roster.error) return json({ error: "Couldn't load the firm" }, 500);

  let invites: FirmInvite[] | null = null;
  if (decideFirm(access.role, "members:invite")) {
    // Never select token_hash: links are shown once, when created.
    const { data } = await supabase
      .from("firm_invites")
      .select("id, email, role, created_at, expires_at")
      .eq("firm_id", id)
      .order("created_at", { ascending: false })
      .returns<InviteRow[]>();
    const now = Date.now();
    invites = (data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.created_at,
      expiresAt: i.expires_at,
      expired: new Date(i.expires_at).getTime() <= now,
    }));
  }

  const members: FirmMember[] = ((roster.data as RosterRow[] | null) ?? []).map((m) => ({ userId: m.user_id, email: m.email, role: m.role, joinedAt: m.joined_at }));
  return json({ firm: { ...firm.data, role: access.role }, me: access.userId, members, invites } satisfies FirmDetail);
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/firms/[id]">) {
  const { id } = await ctx.params;
  const access = await authorizeFirm(id, "firm:rename");
  if (!access) return notFound();
  const body = await readBody(request, firmNameBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  const { data, error } = await access.supabase.from("firms").update({ name: body.data.name }).eq("id", id).select("id");
  if (error || !data?.length) return json({ error: "Couldn't rename the firm" }, 500);

  await recordAudit({ firmId: id, actorId: access.userId, action: "firm.renamed" });
  return json({ ok: true });
}
