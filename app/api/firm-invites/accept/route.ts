import type { NextRequest } from "next/server";
import { recordAudit } from "@/lib/audit/server";
import { inviteTokenBodySchema } from "@/lib/firms/schema";
import { signedIn } from "@/lib/firms/server";
import { json, notFound, readBody } from "@/lib/room/server";
import { hashToken } from "@/lib/room/tokens";

/**
 * Accepts an invitation as the signed-in advisor. accept_firm_invite() checks
 * the link, its expiry and that the caller's confirmed email is the invited
 * one, then adds the membership and spends the link, in one statement.
 */
export async function POST(request: NextRequest) {
  const body = await readBody(request, inviteTokenBodySchema);
  if (!body.ok) return body.status === 400 ? notFound() : json({ error: body.error }, body.status);
  const session = await signedIn();
  if (!session) return json({ error: "Sign in to accept this invitation" }, 401);

  const { data: firmId, error } = await session.supabase.rpc("accept_firm_invite", { invite_hash: hashToken(body.data.token) });
  if (error) {
    // Errcodes raised by the function; anything else is unexpected.
    if (error.code === "P0002") return json({ error: error.message }, 410);
    if (error.code === "42501") return json({ error: error.message }, 403);
    return json({ error: "Couldn't accept the invitation" }, 500);
  }
  if (typeof firmId !== "string") return json({ error: "Couldn't accept the invitation" }, 500);

  await recordAudit({ firmId, actorId: session.userId, action: "firm.member_joined" });
  return json({ firmId });
}
