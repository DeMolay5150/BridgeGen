import type { NextRequest } from "next/server";
import { recordAudit } from "@/lib/audit/server";
import { EMPTY_RESPONSE } from "@/lib/room/response";
import { responseBodySchema, stakeholderSchema, tokenSchema } from "@/lib/room/schema";
import { inviteForToken, json, loadResponses, notFound, readBody } from "@/lib/room/server";
import { hashToken } from "@/lib/room/tokens";
import { PREDICTION_TARGET } from "@/lib/room/topics";
import { STAKEHOLDER_LABELS } from "@/lib/simulator/alignment";
import { getAdminClient } from "@/lib/supabase/admin";

async function resolve(ctx: RouteContext<"/api/respond/[token]">) {
  const { token } = await ctx.params;
  if (!tokenSchema.safeParse(token).success) return null;
  const invite = await inviteForToken(token);
  const stakeholder = stakeholderSchema.safeParse(invite?.stakeholder);
  return invite && stakeholder.success
    ? { companyId: invite.company_id, stakeholder: stakeholder.data, tokenHash: hashToken(token) }
    : null;
}

/** What the invited stakeholder sees: who they are, whose answers they predict, and only their own answers. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/respond/[token]">) {
  const invite = await resolve(ctx);
  if (!invite) return notFound();

  const { data: company } = await getAdminClient()
    .from("companies")
    .select("name")
    .eq("id", invite.companyId)
    .maybeSingle<{ name: string }>();
  const responses = await loadResponses(invite.companyId);
  // Answers saved through a link that has since been replaced stay hidden from the new one.
  const { data: own } = await getAdminClient()
    .from("room_responses")
    .select("invite_token_hash")
    .eq("company_id", invite.companyId)
    .eq("stakeholder", invite.stakeholder)
    .maybeSingle<{ invite_token_hash: string | null }>();
  const response = own?.invite_token_hash === invite.tokenHash ? responses[invite.stakeholder] : undefined;

  return json({
    companyName: company?.name ?? "",
    stakeholder: invite.stakeholder,
    stakeholderLabel: STAKEHOLDER_LABELS[invite.stakeholder],
    targetLabel: STAKEHOLDER_LABELS[PREDICTION_TARGET[invite.stakeholder]],
    response: response ?? EMPTY_RESPONSE,
  });
}

/** Saves the invited stakeholder's answers. The token is the only credential. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/respond/[token]">) {
  const invite = await resolve(ctx);
  if (!invite) return notFound();

  const body = await readBody(request, responseBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  const { error } = await getAdminClient()
    .from("room_responses")
    .upsert(
      { company_id: invite.companyId, stakeholder: invite.stakeholder, invite_token_hash: invite.tokenHash, ...body.data },
      { onConflict: "company_id,stakeholder" },
    );
  if (error) return json({ error: "Couldn't save your answers" }, 500);

  // Who and when, never what: the answers stay out of the audit trail.
  await recordAudit({
    companyId: invite.companyId,
    actorId: null,
    action: body.data.submitted ? "room.response_submitted" : "room.response_reopened",
    metadata: { stakeholder: invite.stakeholder },
  });
  return json({ ok: true });
}
