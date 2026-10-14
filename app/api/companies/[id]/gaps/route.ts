import type { NextRequest } from "next/server";
import { detectGaps } from "@/lib/room/gaps";
import { json, loadResponses, notFound, accessibleCompany } from "@/lib/room/server";

/**
 * The facilitator's view of the room: completion plus disagreements and
 * misperceptions. Raw answers are read server-side and never leave it;
 * detectGaps' output carries only topics, distances and who misreads whom.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/companies/[id]/gaps">) {
  const { id } = await ctx.params;
  const company = await accessibleCompany(id);
  if (!company) return notFound();
  return json(detectGaps(await loadResponses(company.id)));
}
