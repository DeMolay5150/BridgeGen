/*
 * Policy-based permissions, Cerbos-style: decisions come from a declarative
 * table (resource × action → derived roles), not from if-statements spread
 * through handlers. Default deny. RLS remains the hard boundary underneath:
 * this layer can only narrow what the database already allows, and it makes
 * every decision explainable and auditable.
 */

export type FirmRole = "owner" | "admin" | "member";

export interface Principal {
  id: string;
  /** Role in the firm that owns the resource; null when not a member. */
  firmRole: FirmRole | null;
}

export interface CompanyResource {
  kind: "company";
  /** Who created the company (null after their account was deleted). */
  ownerId: string | null;
}

/** Roles derived from the principal and the resource, as Cerbos derives them. */
export type DerivedRole = "firm_owner" | "firm_admin" | "firm_member" | "company_creator";

export type CompanyAction =
  | "read"
  | "update"
  | "delete"
  | "room:view_gaps"
  | "room:invite"
  /** Replace an existing link, which disables the one already sent. */
  | "room:rotate_invite"
  | "report:export";

const ANY_MEMBER: DerivedRole[] = ["firm_owner", "firm_admin", "firm_member"];

/** The policy. Kept in step with the RLS policies in supabase/migrations. */
export const COMPANY_POLICY: Record<CompanyAction, DerivedRole[]> = {
  read: ANY_MEMBER,
  update: ANY_MEMBER,
  delete: ["firm_owner", "firm_admin", "company_creator"],
  "room:view_gaps": ANY_MEMBER,
  "room:invite": ANY_MEMBER,
  "room:rotate_invite": ["firm_owner", "firm_admin", "company_creator"],
  "report:export": ANY_MEMBER,
};

export function derivedRoles(principal: Principal, resource: CompanyResource): DerivedRole[] {
  const roles: DerivedRole[] = [];
  if (principal.firmRole) roles.push(`firm_${principal.firmRole}` as DerivedRole);
  // Creators keep creator rights only while they're still in the firm.
  if (principal.firmRole && resource.ownerId !== null && resource.ownerId === principal.id) roles.push("company_creator");
  return roles;
}

export interface Decision {
  allowed: boolean;
  action: CompanyAction;
  /** The derived role that granted access, or why it was denied. */
  reason: string;
}

export function decide(principal: Principal, resource: CompanyResource, action: CompanyAction): Decision {
  const roles = derivedRoles(principal, resource);
  const granted = COMPANY_POLICY[action].find((role) => roles.includes(role));
  return granted
    ? { allowed: true, action, reason: granted }
    : { allowed: false, action, reason: roles.length ? `requires ${COMPANY_POLICY[action].join(" or ")}` : "not a firm member" };
}
