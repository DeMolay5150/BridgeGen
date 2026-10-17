import { describe, expect, it } from "vitest";
import {
  COMPANY_POLICY,
  FIRM_POLICY,
  canChangeMember,
  decide,
  decideFirm,
  invitableRoles,
  type CompanyAction,
  type FirmAction,
  type FirmRole,
} from "./policy";

const company = { kind: "company" as const, ownerId: "creator" };
const as = (firmRole: FirmRole | null, id = "someone") => ({ id, firmRole });
const ACTIONS = Object.keys(COMPANY_POLICY) as CompanyAction[];

describe("company policy", () => {
  it("denies everything to non-members, even the original creator", () => {
    for (const action of ACTIONS) {
      expect(decide(as(null), company, action)).toMatchObject({ allowed: false, reason: "not a firm member" });
      expect(decide(as(null, "creator"), company, action).allowed).toBe(false);
    }
  });

  it("lets owners and admins do everything", () => {
    for (const role of ["owner", "admin"] as const) {
      for (const action of ACTIONS) expect(decide(as(role), company, action).allowed).toBe(true);
    }
  });

  it("lets members work on the room but not delete companies or replace a colleague's links", () => {
    const member = as("member");
    for (const action of ["read", "update", "room:view_gaps", "room:invite", "report:export"] as const) {
      expect(decide(member, company, action)).toMatchObject({ allowed: true, reason: "firm_member" });
    }
    expect(decide(member, company, "delete")).toMatchObject({
      allowed: false,
      reason: "requires firm_owner or firm_admin or company_creator",
    });
    expect(decide(member, company, "room:rotate_invite").allowed).toBe(false);
  });

  it("gives a member who created the company creator rights", () => {
    const creator = as("member", "creator");
    expect(decide(creator, company, "delete")).toMatchObject({ allowed: true, reason: "company_creator" });
    expect(decide(creator, company, "room:rotate_invite").allowed).toBe(true);
  });

  it("gives no one creator rights over a company whose creator is gone", () => {
    expect(decide(as("member", "x"), { kind: "company", ownerId: null }, "delete").allowed).toBe(false);
  });

  it("mirrors the RLS delete rule: creators, owners and admins", () => {
    expect(COMPANY_POLICY.delete).toEqual(["firm_owner", "firm_admin", "company_creator"]);
  });
});

describe("firm policy", () => {
  it("lets every member view the firm, but only owners and admins rename it or invite", () => {
    expect(decideFirm("member", "firm:view")).toBe(true);
    for (const action of ["firm:rename", "members:invite"] as const) {
      expect(decideFirm("owner", action)).toBe(true);
      expect(decideFirm("admin", action)).toBe(true);
      expect(decideFirm("member", action)).toBe(false);
    }
    for (const action of Object.keys(FIRM_POLICY) as FirmAction[]) expect(decideFirm(null, action)).toBe(false);
  });

  it("never offers owner in an invitation, and offers nothing to members", () => {
    expect(invitableRoles("owner")).toEqual(["admin", "member"]);
    expect(invitableRoles("admin")).toEqual(["admin", "member"]);
    expect(invitableRoles("member")).toEqual([]);
    expect(invitableRoles(null)).toEqual([]);
  });

  const actor = (role: FirmRole | null, id = "actor") => ({ id, role });
  const target = (role: FirmRole, id = "target") => ({ id, role });

  it("lets owners change anyone's role or remove anyone", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      expect(canChangeMember(actor("owner"), target(role), { kind: "remove" })).toBe(true);
      expect(canChangeMember(actor("owner"), target(role), { kind: "role", role: "owner" })).toBe(true);
    }
  });

  it("keeps admins away from owners and from granting owner (mirrors RLS)", () => {
    expect(canChangeMember(actor("admin"), target("member"), { kind: "role", role: "admin" })).toBe(true);
    expect(canChangeMember(actor("admin"), target("admin"), { kind: "remove" })).toBe(true);
    expect(canChangeMember(actor("admin"), target("member"), { kind: "role", role: "owner" })).toBe(false);
    expect(canChangeMember(actor("admin"), target("owner"), { kind: "remove" })).toBe(false);
    expect(canChangeMember(actor("admin"), target("owner"), { kind: "role", role: "member" })).toBe(false);
  });

  it("lets anyone leave, but members change nothing else, and outsiders nothing at all", () => {
    expect(canChangeMember(actor("member", "me"), target("member", "me"), { kind: "remove" })).toBe(true);
    expect(canChangeMember(actor("member"), target("member"), { kind: "remove" })).toBe(false);
    expect(canChangeMember(actor("member", "me"), target("member", "me"), { kind: "role", role: "admin" })).toBe(false);
    expect(canChangeMember(actor(null, "me"), target("member", "me"), { kind: "remove" })).toBe(false);
  });
});
