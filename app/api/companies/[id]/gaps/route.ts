import type { NextRequest } from "next/server";
import { detectGaps } from "@/lib/room/gaps";
import { authorize, json, loadResponses, notFound } from "@/lib/room/server";
import { getServerClient } from "@/lib/supabase/server";

/**
 * The facilitator's view of the room: completion plus disagreements and
 * misperceptions. Raw answers are read server-side and never leave it;
 * detectGaps' output carries only topics, distances and who misreads whom.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/companies/[id]/gaps">) {
  const { id } = await ctx.params;
  const access = await authorize(id, "room:view_gaps");
  if (!access) return notFound();
  // Heirs who have a link but haven't answered still count as outstanding.
  const supabase = (await getServerClient())!;
  const { data: invites } = await supabase
    .from("room_invites")
    .select("stakeholder")
    .eq("company_id", access.company.id)
    .returns<{ stakeholder: string }[]>();
  return json(detectGaps(await loadResponses(access.company.id), invites?.map((i) => i.stakeholder) ?? []));
}
