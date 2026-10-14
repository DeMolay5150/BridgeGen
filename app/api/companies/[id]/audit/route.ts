import type { NextRequest } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit/server";
import { authorize, json, notFound, readBody } from "@/lib/room/server";

/** Events the browser may report: exports happen client-side, so the server can't see them. */
const clientEventSchema = z.object({
  action: z.enum(["report.exported", "deck.exported"]),
  format: z.enum(["pdf", "pptx", "md"]),
});

export async function POST(request: NextRequest, ctx: RouteContext<"/api/companies/[id]/audit">) {
  const { id } = await ctx.params;
  const access = await authorize(id, "report:export");
  if (!access) return notFound();

  const body = await readBody(request, clientEventSchema);
  if (!body.ok) return json({ error: body.error }, body.status);

  await recordAudit({
    companyId: access.company.id,
    actorId: access.principal.id,
    action: body.data.action,
    metadata: { format: body.data.format },
  });
  return json({ ok: true }, 202);
}
