import "server-only";
import { getAdminClient } from "../supabase/admin";

/** Every action the audit trail records. Metadata must never carry stakeholder answers. */
export type AuditAction =
  | "room.invite_created"
  | "room.invite_rotated"
  | "room.response_submitted"
  | "room.response_reopened"
  | "report.exported"
  | "deck.exported";

export interface AuditEvent {
  companyId: string;
  /** Null for stakeholders, who act through an invite token rather than an account. */
  actorId: string | null;
  action: AuditAction;
  metadata?: Record<string, string | number | boolean>;
}

let warned = false;

/**
 * Appends an event, best effort: a failed write is logged, never surfaced to
 * the user or allowed to fail the action it describes. A no-op until the
 * firms and audit migrations are applied.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const admin = getAdminClient();
    const { data: company, error: lookupError } = await admin
      .from("companies")
      .select("firm_id")
      .eq("id", event.companyId)
      .maybeSingle<{ firm_id: string }>();
    if (lookupError || !company?.firm_id) throw lookupError ?? new Error("no firm");
    const { error } = await admin.from("audit_events").insert({
      firm_id: company.firm_id,
      company_id: event.companyId,
      actor_id: event.actorId,
      action: event.action,
      metadata: event.metadata ?? {},
    });
    if (error) throw error;
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn("Audit trail unavailable (are the firms and audit migrations applied?):", error);
    }
  }
}
