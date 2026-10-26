import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectGaps } from "../../lib/room/gaps";
import { generateToken, hashToken } from "../../lib/room/tokens";
import { DEMO_RESPONSES } from "../../lib/room/topics";
import { STAKEHOLDER_IDS } from "../../lib/simulator/alignment";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const configured = url.startsWith("https://") && publishable.length > 20 && secret.length > 20;
/** Set to test the API routes too, e.g. BRIDGEGEN_BASE_URL=http://localhost:3000 */
const baseUrl = process.env.BRIDGEGEN_BASE_URL;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const password = `Rls-${randomUUID()}`;
const run = randomUUID().slice(0, 8);

let admin: SupabaseClient;
let alice: SupabaseClient;
let bob: SupabaseClient;
let carol: SupabaseClient;
let anon: SupabaseClient;
const userIds: string[] = [];
let companyId = "";
let firmId = "";

async function signedInUser(label: string): Promise<SupabaseClient> {
  const email = `rls-${label}-${run}@example.test`;
  emails[label] = email;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  userIds.push(data.user.id);
  const client = createClient(url, publishable, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

const emails: Record<string, string> = {};

/** Signs in through @supabase/ssr and returns the Cookie header a browser would send. */
async function sessionCookie(label: string): Promise<string> {
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishable, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: emails[label], password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** A read that RLS or revoked privileges block: either an error or no rows. */
async function expectNoRows(query: PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  const { data, error } = await query;
  expect(error !== null || (data ?? []).length === 0).toBe(true);
}

describe.skipIf(!configured)("row-level security (live Supabase project)", () => {
  beforeAll(async () => {
    admin = createClient(url, secret, noSession);
    anon = createClient(url, publishable, noSession);
    alice = await signedInUser("alice");
    bob = await signedInUser("bob");
    carol = await signedInUser("carol");
    const { data, error } = await alice.from("companies").insert({ name: `RLS check ${run}` }).select("id, firm_id").single();
    if (error || !data) throw error ?? new Error("insert failed");
    companyId = data.id;
    firmId = data.firm_id;
  });

  afterAll(async () => {
    // Deleting the users cascades to their companies, invites and responses.
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("lets the owner read and update their company", async () => {
    const { data } = await alice.from("companies").select("id").eq("id", companyId);
    expect(data).toHaveLength(1);
    const { error } = await alice.from("companies").update({ name: `Renamed ${run}` }).eq("id", companyId);
    expect(error).toBeNull();
  });

  it("hides another advisor's company from reads, updates and deletes", async () => {
    await expectNoRows(bob.from("companies").select("id").eq("id", companyId));
    await bob.from("companies").update({ name: "hijacked" }).eq("id", companyId);
    await bob.from("companies").delete().eq("id", companyId);
    const { data } = await admin.from("companies").select("name").eq("id", companyId).single();
    expect(data?.name).toBe(`Renamed ${run}`);
  });

  it("stops another advisor creating invites for someone else's company", async () => {
    const { error } = await bob
      .from("room_invites")
      .insert({ company_id: companyId, stakeholder: "founder", token_hash: hashToken(generateToken()) });
    expect(error).not.toBeNull();
  });

  it("gives signed-out visitors nothing", async () => {
    await expectNoRows(anon.from("companies").select("id"));
    await expectNoRows(anon.from("room_invites").select("id"));
    await expectNoRows(anon.from("room_responses").select("stakeholder"));
  });

  it("never lets the advisor read raw Decision Room answers, even for their own company", async () => {
    const { error } = await admin
      .from("room_responses")
      .insert({ company_id: companyId, stakeholder: "founder", ...DEMO_RESPONSES.founder });
    expect(error).toBeNull();
    await expectNoRows(alice.from("room_responses").select("positions").eq("company_id", companyId));
    const { error: writeError } = await alice
      .from("room_responses")
      .upsert({ company_id: companyId, stakeholder: "nextGen", positions: {}, predictions: {}, submitted: true });
    expect(writeError).not.toBeNull();
  });

  describe("multi-seat firms", () => {
    it("files a new advisor's first company in their own personal firm, as its owner", async () => {
      expect(firmId).toMatch(/^[0-9a-f-]{36}$/);
      const { data } = await alice.from("firm_members").select("role").eq("firm_id", firmId);
      expect(data).toEqual([{ role: "owner" }]);
    });

    it("refuses to let an outsider join a firm or create firms directly", async () => {
      const { error } = await bob.from("firm_members").insert({ firm_id: firmId, user_id: userIds[1], role: "owner" });
      expect(error).not.toBeNull();
      const { error: firmError } = await bob.from("firms").insert({ name: "Shadow firm" });
      expect(firmError).not.toBeNull();
    });

    it("shares the firm's companies with a member, who can edit but not delete them", async () => {
      // Colleagues join only by accepting an invitation (20261025100000): even an owner can't add one directly.
      const { error: direct } = await alice.from("firm_members").insert({ firm_id: firmId, user_id: userIds[2] });
      expect(direct?.code).toBe("42501");
      const invite = generateToken();
      const { error: inviteError } = await alice
        .from("firm_invites")
        .insert({ firm_id: firmId, email: emails.carol, role: "member", token_hash: hashToken(invite) });
      expect(inviteError).toBeNull();
      const { data: joined, error } = await carol.rpc("accept_firm_invite", { invite_hash: hashToken(invite) });
      expect(error).toBeNull();
      expect(joined).toBe(firmId);
      const { data } = await carol.from("companies").select("id").eq("id", companyId);
      expect(data).toHaveLength(1);
      const { error: updateError } = await carol.from("companies").update({ name: `Shared ${run}` }).eq("id", companyId);
      expect(updateError).toBeNull();
      await carol.from("companies").delete().eq("id", companyId);
      const { data: still } = await admin.from("companies").select("id").eq("id", companyId);
      expect(still).toHaveLength(1);
      // Restore the name the API tests below rely on.
      await alice.from("companies").update({ name: `Renamed ${run}` }).eq("id", companyId);
    });

    it("stops a member promoting themself or adding colleagues", async () => {
      const { data } = await carol.from("firm_members").update({ role: "owner" }).eq("firm_id", firmId).eq("user_id", userIds[2]).select();
      expect(data ?? []).toHaveLength(0);
      const { error } = await carol.from("firm_members").insert({ firm_id: firmId, user_id: userIds[1] });
      expect(error).not.toBeNull();
    });

    it("never lets a firm member read raw Decision Room answers", async () => {
      await expectNoRows(carol.from("room_responses").select("positions").eq("company_id", companyId));
    });

    it("never lets signed-in users write or read someone else's audit trail", async () => {
      const event = { firm_id: firmId, company_id: companyId, actor_id: userIds[0], action: "room.invite_created" };
      const { error } = await alice.from("audit_events").insert(event);
      expect(error).not.toBeNull();
      await admin.from("audit_events").insert(event);
      const { data } = await alice.from("audit_events").select("action").eq("company_id", companyId);
      expect((data ?? []).length).toBeGreaterThan(0);
      await expectNoRows(bob.from("audit_events").select("id").eq("company_id", companyId));
    });

    it("keeps a firm's last owner from leaving", async () => {
      const { error } = await alice.from("firm_members").delete().eq("firm_id", firmId).eq("user_id", userIds[0]);
      expect(error).not.toBeNull();
    });
  });

  describe("firm invitations", () => {
    const token = generateToken();

    it("lets an owner invite by email but not a plain member, and hides invitations from outsiders", async () => {
      const { error } = await alice.from("firm_invites").insert({ firm_id: firmId, email: emails.bob, role: "member", token_hash: hashToken(token) });
      expect(error).toBeNull();
      const { error: memberError } = await carol
        .from("firm_invites")
        .insert({ firm_id: firmId, email: "someone@example.test", role: "member", token_hash: hashToken(generateToken()) });
      expect(memberError).not.toBeNull();
      await expectNoRows(bob.from("firm_invites").select("id"));
      await expectNoRows(anon.from("firm_invites").select("id"));
    });

    it("previews the invitation without revealing the invited address", async () => {
      const { data } = await bob.rpc("firm_invite_preview", { invite_hash: hashToken(token) });
      expect(data).toEqual([expect.objectContaining({ role: "member", email_matches: true, expired: false, already_member: false })]);
      expect(JSON.stringify(data)).not.toContain(emails.bob);
      const { data: other } = await carol.rpc("firm_invite_preview", { invite_hash: hashToken(token) });
      expect((other as { email_matches: boolean }[])[0].email_matches).toBe(false);
    });

    it("refuses a forwarded link, accepts the invitee once, and shows them the roster", async () => {
      const { error: forwarded } = await carol.rpc("accept_firm_invite", { invite_hash: hashToken(token) });
      expect(forwarded).not.toBeNull();
      const { data: joined, error } = await bob.rpc("accept_firm_invite", { invite_hash: hashToken(token) });
      expect(error).toBeNull();
      expect(joined).toBe(firmId);
      const { error: reused } = await bob.rpc("accept_firm_invite", { invite_hash: hashToken(token) });
      expect(reused).not.toBeNull();
      const { data: companies } = await bob.from("companies").select("id").eq("id", companyId);
      expect(companies).toHaveLength(1);
      const { data: roster } = await bob.rpc("firm_roster", { target: firmId });
      expect((roster as { email: string }[]).map((m) => m.email).sort()).toEqual([emails.alice, emails.bob, emails.carol].sort());
      // Leave again: the API tests below rely on bob being an outsider.
      const { error: leaveError } = await bob.from("firm_members").delete().eq("firm_id", firmId).eq("user_id", userIds[1]);
      expect(leaveError).toBeNull();
    });

    it("gives outsiders and signed-out visitors no roster", async () => {
      const { data } = await bob.rpc("firm_roster", { target: firmId });
      expect(data ?? []).toHaveLength(0);
      const { error } = await anon.rpc("firm_roster", { target: firmId });
      expect(error).not.toBeNull();
    });
  });

  describe.skipIf(!baseUrl)("API routes", () => {
    it("rejects unknown and malformed invite tokens with 404", async () => {
      expect((await fetch(`${baseUrl}/api/respond/${generateToken()}`)).status).toBe(404);
      expect((await fetch(`${baseUrl}/api/respond/not-a-token`)).status).toBe(404);
    });

    it("serves a valid invite only its own stakeholder's answers", async () => {
      const token = generateToken();
      await admin.from("room_invites").insert({ company_id: companyId, stakeholder: "founder", token_hash: hashToken(token) });
      const read = async () => {
        const res = await fetch(`${baseUrl}/api/respond/${token}`);
        expect(res.status).toBe(200);
        return res.json();
      };
      // Answers saved before this link existed (the direct insert above) stay hidden from it (finding D1).
      const fresh = await read();
      expect(fresh.stakeholder).toBe("founder");
      expect(fresh.response.positions).toEqual({});
      // Answers saved through the link are served back to it, and only the founder's. A draft, so the
      // end-to-end test below still counts exactly one submission per stakeholder in the audit trail.
      const save = await fetch(`${baseUrl}/api/respond/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...DEMO_RESPONSES.founder, submitted: false }),
      });
      expect(save.status).toBe(200);
      const body = await read();
      expect(body.response.positions).toEqual(DEMO_RESPONSES.founder!.positions);
      expect(JSON.stringify(body)).not.toContain("nextGen\":{");
    });

    it("refuses the gaps endpoint to anyone who isn't signed in as the owner", async () => {
      expect((await fetch(`${baseUrl}/api/companies/${companyId}/gaps`)).status).toBe(404);
      expect((await fetch(`${baseUrl}/api/companies/${companyId}/invites`)).status).toBe(404);
    });

    it("runs a confidential Decision Room end to end", async () => {
      const ownerCookie = await sessionCookie("alice");
      const otherCookie = await sessionCookie("bob");
      const asOwner = (path: string, init: RequestInit = {}) =>
        fetch(`${baseUrl}${path}`, { ...init, headers: { ...init.headers, Cookie: ownerCookie, "Content-Type": "application/json" } });

      // The owner creates one private link per stakeholder; links are returned once.
      const links: Record<string, string> = {};
      for (const stakeholder of STAKEHOLDER_IDS) {
        const res = await asOwner(`/api/companies/${companyId}/invites`, { method: "POST", body: JSON.stringify({ stakeholder }) });
        expect(res.status).toBe(201);
        links[stakeholder] = new URL((await res.json()).url).pathname.split("/").pop()!;
      }

      // Each stakeholder answers through their own link only.
      for (const stakeholder of STAKEHOLDER_IDS) {
        const res = await fetch(`${baseUrl}/api/respond/${links[stakeholder]}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(DEMO_RESPONSES[stakeholder]),
        });
        expect(res.status).toBe(200);
      }

      // The owner sees exactly the gaps in-memory detection finds, and nothing raw.
      const gapsRes = await asOwner(`/api/companies/${companyId}/gaps`);
      expect(gapsRes.status).toBe(200);
      const gaps = await gapsRes.json();
      expect(gaps).toEqual(detectGaps(DEMO_RESPONSES));
      expect(JSON.stringify(gaps)).not.toMatch(/positions|predictions/);

      // The audit trail records who issued links and who submitted, never what they said.
      const { data: trail } = await admin.from("audit_events").select("action, metadata").eq("company_id", companyId);
      const actions = (trail ?? []).map((e: { action: string }) => e.action);
      expect(actions.filter((a: string) => a === "room.response_submitted")).toHaveLength(STAKEHOLDER_IDS.length);
      expect(JSON.stringify(trail)).not.toMatch(/positions|predictions/);

      // Status shows who has submitted, never what they said.
      const status = await (await asOwner(`/api/companies/${companyId}/invites`)).json();
      expect(status.stakeholders.every((s: { submitted: boolean; invitedAt: string | null }) => s.submitted && s.invitedAt)).toBe(true);
      expect(JSON.stringify(status)).not.toMatch(/positions|predictions/);

      // Another signed-in advisor gets nothing.
      const stranger = await fetch(`${baseUrl}/api/companies/${companyId}/gaps`, { headers: { Cookie: otherCookie } });
      expect(stranger.status).toBe(404);

      // Replacing a link disables the old one but keeps the answers.
      const old = links.founder;
      await asOwner(`/api/companies/${companyId}/invites`, { method: "POST", body: JSON.stringify({ stakeholder: "founder" }) });
      expect((await fetch(`${baseUrl}/api/respond/${old}`)).status).toBe(404);
      expect((await (await asOwner(`/api/companies/${companyId}/gaps`)).json()).completion.founder).toBe(true);
    });
  });
});
