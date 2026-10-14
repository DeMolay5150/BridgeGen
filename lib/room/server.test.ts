import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../supabase/admin", () => ({ getAdminClient: vi.fn() }));

type Result = { data: unknown; error: { code: string } | null };
let responses: Record<string, Result>;

/** A chainable stand-in for the Supabase query builder, answering per "table:columns". */
function fakeClient(userId: string | null) {
  return {
    auth: { getClaims: async () => ({ data: userId ? { claims: { sub: userId } } : null }) },
    from(table: string) {
      let key = table;
      const builder = {
        select(columns: string) {
          key = `${table}:${columns}`;
          return builder;
        },
        eq: () => builder,
        maybeSingle: async () => responses[key] ?? { data: null, error: null },
      };
      return builder;
    },
  };
}

let client = fakeClient("alice");
vi.mock("../supabase/server", () => ({ getServerClient: async () => client }));
vi.mock("../env", () => ({ isSupabaseConfigured: () => true }));

const { authorize, companyAccess } = await import("./server");
const ID = "6f1c2a9e-1b2c-4d5e-8f90-123456789abc";

beforeEach(() => {
  client = fakeClient("alice");
  responses = {};
});

describe("companyAccess", () => {
  it("before the firms migration, treats a visible company as the caller's own (RLS is owner-only)", async () => {
    responses["companies:id, name, owner_id, firm_id"] = { data: null, error: { code: "42703" } };
    responses["companies:id, name, owner_id"] = { data: { id: ID, name: "Hartwell", owner_id: "alice" }, error: null };
    expect(await companyAccess(ID)).toEqual({
      company: { id: ID, name: "Hartwell", ownerId: "alice", firmId: null },
      principal: { id: "alice", firmRole: "owner" },
    });
    expect(await authorize(ID, "room:rotate_invite")).not.toBeNull();
  });

  it("after it, uses the caller's role in the company's firm", async () => {
    responses["companies:id, name, owner_id, firm_id"] = { data: { id: ID, name: "Hartwell", owner_id: "bob", firm_id: "firm-1" }, error: null };
    responses["firm_members:role"] = { data: { role: "member" }, error: null };
    expect((await companyAccess(ID))?.principal).toEqual({ id: "alice", firmRole: "member" });
    expect(await authorize(ID, "room:invite")).not.toBeNull();
    expect(await authorize(ID, "room:rotate_invite")).toBeNull();
  });

  it("never falls back to owner on any other error", async () => {
    responses["companies:id, name, owner_id, firm_id"] = { data: null, error: { code: "57014" } };
    responses["companies:id, name, owner_id"] = { data: { id: ID, name: "Hartwell", owner_id: "alice" }, error: null };
    expect(await companyAccess(ID)).toBeNull();
  });

  it("refuses signed-out callers and malformed ids without querying", async () => {
    client = fakeClient(null);
    expect(await companyAccess(ID)).toBeNull();
    client = fakeClient("alice");
    expect(await companyAccess("not-a-uuid")).toBeNull();
  });
});
