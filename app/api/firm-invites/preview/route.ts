import type { NextRequest } from "next/server";
import type { FirmRole } from "@/lib/authz/policy";
import { inviteTokenBodySchema, type InvitePreview } from "@/lib/firms/schema";
import { signedIn } from "@/lib/firms/server";
import { json, notFound, readBody } from "@/lib/room/server";
import { hashToken } from "@/lib/room/tokens";

type PreviewRow = { firm_name: string; role: FirmRole; expired: boolean; email_matches: boolean; already_member: boolean };

/**
 * What an invitation link offers. POST so the token stays out of URLs and
 * logs. Signed-out callers get 401 so the page can send them to sign in.
 */
export async function POST(request: NextRequest) {
  const body = await readBody(request, inviteTokenBodySchema);
  if (!body.ok) return body.status === 400 ? notFound() : json({ error: body.error }, body.status);
  const session = await signedIn();
  if (!session) return json({ error: "Sign in to see this invitation" }, 401);

  const { data, error } = await session.supabase.rpc("firm_invite_preview", { invite_hash: hashToken(body.data.token) });
  // Set-returning function: rows arrive as an array (no generated types to say so).
  const row = (data as PreviewRow[] | null)?.[0];
  if (error || !row) return notFound();

  return json({
    firmName: row.firm_name,
    role: row.role,
    expired: row.expired,
    emailMatches: row.email_matches,
    alreadyMember: row.already_member,
  } satisfies InvitePreview);
}
