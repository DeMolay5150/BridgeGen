import type { NextRequest } from "next/server";
import type { FirmRole } from "@/lib/authz/policy";
import { recordAudit } from "@/lib/audit/server";
import { firmNameBodySchema, type FirmSummary } from "@/lib/firms/schema";
import { signedIn } from "@/lib/firms/server";
import { json, notFound, readBody } from "@/lib/room/server";

type MembershipRow = { role: FirmRole; firms: { id: string; name: string } | null };

/** The firms the signed-in advisor belongs to, oldest membership (their personal firm) first. */
export async function GET() {
  const session = await signedIn();
  if (!session) return notFound();
  const { data, error } = await session.supabase
    .from("firm_members")
    .select("role, firms(id, name)")
    .eq("user_id", session.userId)
    .order("created_at")
    .returns<MembershipRow[]>();
  if (error) return json({ error: "Couldn't load your firms" }, 500);
  const firms: FirmSummary[] = (data ?? []).flatMap((m) => (m.firms ? [{ id: m.firms.id, name: m.firms.name, role: m.role }] : []));
  return json({ firms });
}

/** Creates a firm with the caller as its owner (one step, via create_firm()). */
export async function POST(request: NextRequest) {
  const session = await signedIn();
  if (!session) return notFound();
  const body = await readBody(request, firmNameBodySchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  const { data: id, error } = await session.supabase.rpc("create_firm", { firm_name: body.data.name });
  if (error || typeof id !== "string") return json({ error: "Couldn't create the firm" }, 500);

  await recordAudit({ firmId: id, actorId: session.userId, action: "firm.created" });
  return json({ firm: { id, name: body.data.name, role: "owner" } satisfies FirmSummary }, 201);
}
