import "server-only";
import { getAdminClient } from "../supabase/admin";

/** Every action the audit trail records. Metadata must never carry stakeholder answers. */
export type AuditAction =
  | "room.invite_created"
  | "room.invite_rotated"
  | "room.response_submitted"
  | "room.response_reopened"
  | "report.exported"
  | "deck.exported"
  | "firm.created"
  | "firm.renamed"
  | "firm.member_invited"
  | "firm.invite_revoked"
  | "firm.member_joined"
  | "firm.role_changed"
  | "firm.member_removed"
  | "firm.member_left";

export type AuditEvent = {
  /** Null for stakeholders, who act through an invite token rather than an account. */
  actorId: string | null;
  action: AuditAction;
  metadata?: Record<string, string | number | boolean>;
} & (
  /** Company events: the firm is looked up from the company. */
  | { companyId: string; firmId?: never }
  /** Firm events (membership, invitations) have no company. */
  | { firmId: string; companyId?: never }
);

async function firmOf(event: AuditEvent): Promise<string> {
  if (event.firmId) return event.firmId;
  const { data: company, error } = await getAdminClient()
    .from("companies")
    .select("firm_id")
    .eq("id", event.companyId!)
    .maybeSingle<{ firm_id: string }>();
  if (error || !company?.firm_id) throw error ?? new Error("no firm");
  return company.firm_id;
}

let warned = false;

/**
 * Appends an event, best effort: a failed write is logged, never surfaced to
 * the user or allowed to fail the action it describes. A no-op until the
 * firms and audit migrations are applied.
 */
export async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    const { error } = await getAdminClient().from("audit_events").insert({
      firm_id: await firmOf(event),
      company_id: event.companyId ?? null,
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
