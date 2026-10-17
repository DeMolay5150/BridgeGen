import type { NextRequest } from "next/server";
import { z } from "zod";
import { canChangeMember, type FirmRole, type MemberChange } from "@/lib/authz/policy";
import { recordAudit } from "@/lib/audit/server";
import { memberRoleBodySchema } from "@/lib/firms/schema";
import { firmAccess, isLastOwnerError, type FirmAccess } from "@/lib/firms/server";
import { json, notFound, readBody } from "@/lib/room/server";

type Ctx = RouteContext<"/api/firms/[id]/members/[userId]">;

const LAST_OWNER = "A firm must keep at least one owner. Make someone else an owner first.";
const REFUSED = "Owners manage everyone; admins manage everyone except owners and can't grant owner.";

/** The caller's access and the target's current role, when both are in the firm. */
async function load(ctx: Ctx): Promise<{ access: FirmAccess; userId: string; targetRole: FirmRole } | null> {
  const { id, userId } = await ctx.params;
  if (!z.uuid().safeParse(userId).success) return null;
  const access = await firmAccess(id);
  if (!access) return null;
  const { data } = await access.supabase
    .from("firm_members")
    .select("role")
    .eq("firm_id", id)
    .eq("user_id", userId)
    .maybeSingle<{ role: FirmRole }>();
  return data ? { access, userId, targetRole: data.role } : null;
}

const allowed = (loaded: NonNullable<Awaited<ReturnType<typeof load>>>, change: MemberChange) =>
  canChangeMember({ id: loaded.access.userId, role: loaded.access.role }, { id: loaded.userId, role: loaded.targetRole }, change);

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const loaded = await load(ctx);
  if (!loaded) return notFound();
  const body = await readBody(request, memberRoleBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);
  const { access, userId, targetRole } = loaded;
  if (body.data.role === targetRole) return json({ ok: true });
  if (!allowed(loaded, { kind: "role", role: body.data.role })) return json({ error: REFUSED }, 403);

  // RLS applies to this write too; a refused update simply matches no rows.
  const { data, error } = await access.supabase
    .from("firm_members")
    .update({ role: body.data.role })
    .eq("firm_id", access.firmId)
    .eq("user_id", userId)
    .select("role");
  if (isLastOwnerError(error)) return json({ error: LAST_OWNER }, 409);
  if (error || !data?.length) return json({ error: "Couldn't change the role" }, 500);

  await recordAudit({
    firmId: access.firmId,
    actorId: access.userId,
    action: "firm.role_changed",
    metadata: { member: userId, from: targetRole, to: body.data.role },
  });
  return json({ ok: true });
}

/** Removes a colleague, or leaves the firm when the target is the caller. */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const loaded = await load(ctx);
  if (!loaded) return notFound();
  const { access, userId, targetRole } = loaded;
  if (!allowed(loaded, { kind: "remove" })) return json({ error: REFUSED }, 403);

  const { data, error } = await access.supabase
    .from("firm_members")
    .delete()
    .eq("firm_id", access.firmId)
    .eq("user_id", userId)
    .select("user_id");
  if (isLastOwnerError(error)) return json({ error: LAST_OWNER }, 409);
  if (error || !data?.length) return json({ error: "Couldn't remove the member" }, 500);

  const leaving = userId === access.userId;
  await recordAudit({
    firmId: access.firmId,
    actorId: access.userId,
    action: leaving ? "firm.member_left" : "firm.member_removed",
    metadata: leaving ? { role: targetRole } : { member: userId, role: targetRole },
  });
  return json({ ok: true });
}
