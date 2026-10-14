import { describe, expect, it } from "vitest";
import { COMPANY_POLICY, decide, type CompanyAction, type FirmRole } from "./policy";

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
