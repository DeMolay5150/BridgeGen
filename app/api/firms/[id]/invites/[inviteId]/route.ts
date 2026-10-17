import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit/server";
import { authorizeFirm } from "@/lib/firms/server";
import { json, notFound } from "@/lib/room/server";

/** Revokes a pending invitation; its link stops working immediately. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/firms/[id]/invites/[inviteId]">) {
  const { id, inviteId } = await ctx.params;
  if (!z.uuid().safeParse(inviteId).success) return notFound();
  const access = await authorizeFirm(id, "members:invite");
  if (!access) return notFound();

  const { data, error } = await access.supabase
    .from("firm_invites")
    .delete()
    .eq("firm_id", id)
    .eq("id", inviteId)
    .select("email")
    .returns<{ email: string }[]>();
  if (error) return json({ error: "Couldn't revoke the invitation" }, 500);
  if (!data?.length) return notFound();

  await recordAudit({ firmId: id, actorId: access.userId, action: "firm.invite_revoked", metadata: { email: data[0].email } });
  return json({ ok: true });
}
