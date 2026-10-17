import { z } from "zod";
import type { FirmRole } from "../authz/policy";
import { tokenSchema } from "../room/schema";

export const firmRoleSchema = z.enum(["owner", "admin", "member"] satisfies FirmRole[]);

export const firmNameSchema = z.string().trim().min(1).max(120);

export const firmNameBodySchema = z.object({ name: firmNameSchema });

/** Emails are compared lower-cased, as the database stores them. */
export const firmInviteBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  role: z.enum(["admin", "member"]),
});

export const memberRoleBodySchema = z.object({ role: firmRoleSchema });

/** Invite tokens travel in the body, not the URL, so they stay out of request logs. */
export const inviteTokenBodySchema = z.object({ token: tokenSchema });

/** How long a firm invitation link stays valid. Matches the column default. */
export const FIRM_INVITE_DAYS = 7;

export const ROLE_LABELS: Record<FirmRole, string> = { owner: "Owner", admin: "Admin", member: "Member" };

/** A firm the signed-in advisor belongs to. */
export interface FirmSummary {
  id: string;
  name: string;
  role: FirmRole;
}

export interface FirmMember {
  userId: string;
  email: string;
  role: FirmRole;
  joinedAt: string;
}

/** A pending invitation. The token hash is never sent to the browser. */
export interface FirmInvite {
  id: string;
  email: string;
  role: FirmRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface FirmDetail {
  firm: FirmSummary;
  /** The caller's own user id, so the page can tell "leave" from "remove". */
  me: string;
  members: FirmMember[];
  /** Null when the caller may not manage invitations. */
  invites: FirmInvite[] | null;
}

export interface InvitePreview {
  firmName: string;
  role: FirmRole;
  expired: boolean;
  emailMatches: boolean;
  alreadyMember: boolean;
}
