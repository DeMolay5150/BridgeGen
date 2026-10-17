/**
 * Applies every migration in supabase/migrations to an in-process Postgres
 * (PGlite) with Supabase's auth schema and API roles stubbed, then checks
 * the RLS, trigger and audit rules as different users. No Docker, no live
 * project: run it before `supabase db push`. `pnpm test:migrations`
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const DIR = "supabase/migrations";
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

const db = new PGlite();

// Minimal Supabase stand-ins: auth schema, auth.uid(), API roles.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb);
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
  grant usage on schema realtime to anon, authenticated;
  grant select, insert on realtime.messages to authenticated;
  grant usage on sequence realtime.messages_id_seq to authenticated;
  grant execute on function realtime.topic() to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

const ids = {
  alice: "00000000-0000-0000-0000-00000000000a",
  bob: "00000000-0000-0000-0000-00000000000b",
  carol: "00000000-0000-0000-0000-00000000000c",
  dan: "00000000-0000-0000-0000-00000000000d",
};
for (const [name, id] of Object.entries(ids)) await db.query("insert into auth.users values ($1, $2)", [id, `${name}@x.test`]);

// Apply in order, seeding a pre-firms company just before the firms migration to exercise its backfill.
for (const file of files) {
  if (file.endsWith("_firms.sql")) {
    await db.query("insert into public.companies (owner_id, name) values ($1, 'Legacy Co')", [ids.dan]);
  }
  await db.exec(readFileSync(join(DIR, file), "utf8"));
}
const auditSql = files.some((f) => f.endsWith("_audit_log.sql"));


let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};

/** Runs SQL as a signed-in user, anon or the service role; errors roll back and are returned. */
async function as(who, sql, params = [], topic = "") {
  const role = who === "anon" ? "anon" : who === "service" ? "service_role" : "authenticated";
  try {
    return await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [ids[who] ?? ""]);
      await tx.query("select set_config('realtime.topic', $1, true)", [topic]);
      await tx.exec(`set local role ${role}`);
      const res = await tx.query(sql, params);
      return { rows: res.rows, error: null };
    });
  } catch (error) {
    return { rows: [], error: error.message };
  }
}
const ok = (r) => !r.error;
const failed = (r) => !!r.error;

// Backfill
const legacy = await as("dan", "select c.name, m.role from companies c join firm_members m on m.firm_id = c.firm_id and m.user_id = auth.uid()");
check("backfill: legacy owner owns a personal firm holding their company", legacy.rows[0]?.name === "Legacy Co" && legacy.rows[0]?.role === "owner");

// Default firm on insert (the app inserts without firm_id)
const created = await as("alice", "insert into companies (name) values ('Hartwell') returning id, firm_id");
check("insert without firm_id lands in the creator's personal firm", ok(created) && !!created.rows[0]?.firm_id);
const companyId = created.rows[0]?.id;
const firmId = created.rows[0]?.firm_id;
check("creator owns that firm", (await as("alice", "select role from firm_members where firm_id = $1", [firmId])).rows[0]?.role === "owner");
check("second company joins the same firm", (await as("alice", "insert into companies (name) values ('Second') returning firm_id")).rows[0]?.firm_id === firmId);

// Isolation
check("another advisor can't read the company", (await as("bob", "select id from companies where id = $1", [companyId])).rows.length === 0);
await as("bob", "update companies set name = 'hijack' where id = $1", [companyId]);
await as("bob", "delete from companies where id = $1", [companyId]);
check("another advisor can't update or delete it", (await as("service", "select name from companies where id = $1", [companyId])).rows[0]?.name === "Hartwell");
check("another advisor can't insert into someone else's firm", failed(await as("bob", "insert into companies (name, firm_id) values ('x', $1)", [firmId])));
check("another advisor can't add themself to the firm", failed(await as("bob", "insert into firm_members (firm_id, user_id, role) values ($1, auth.uid(), 'owner')", [firmId])));
const anonRead = await as("anon", "select id from companies");
check("anon sees nothing", failed(anonRead) || anonRead.rows.length === 0);

// Multi-seat
check("owner adds a member", ok(await as("alice", "insert into firm_members (firm_id, user_id) values ($1, $2)", [firmId, ids.carol])));
check("member reads firm companies", (await as("carol", "select id from companies where firm_id = $1", [firmId])).rows.length === 2);
check("member edits a firm company", (await as("carol", "update companies set name = 'Hartwell Holdings' where id = $1 returning id", [companyId])).rows.length === 1);
await as("carol", "delete from companies where id = $1", [companyId]);
check("member can't delete a colleague's company", (await as("service", "select id from companies where id = $1", [companyId])).rows.length === 1);
check("member can't promote themself", (await as("carol", "update firm_members set role = 'owner' where firm_id = $1 and user_id = auth.uid() returning role", [firmId])).rows.length === 0);
check("member can't add others", failed(await as("carol", "insert into firm_members (firm_id, user_id) values ($1, $2)", [firmId, ids.bob])));
const danFirm = (await as("service", "select firm_id from firm_members where user_id = $1", [ids.dan])).rows[0]?.firm_id;
await as("carol", "update companies set firm_id = $2 where id = $1", [companyId, danFirm]);
check("member can't move a company into a firm they don't belong to", (await as("service", "select firm_id from companies where id = $1", [companyId])).rows[0]?.firm_id === firmId);
check("member creates invites for firm companies", ok(await as("carol", "insert into room_invites (company_id, stakeholder, token_hash) values ($1, 'founder', repeat('a', 64))", [companyId])));
check("stranger can't read invites", (await as("bob", "select id from room_invites")).rows.length === 0);

// Confidential answers stay server-only for every role
await as("service", "insert into room_responses (company_id, stakeholder) values ($1, 'founder')", [companyId]);
check("owner can't read raw answers", failed(await as("alice", "select * from room_responses")));
check("member can't read raw answers", failed(await as("carol", "select * from room_responses")));

// Roles
check("owner promotes carol to admin", (await as("alice", "update firm_members set role = 'admin' where firm_id = $1 and user_id = $2 returning role", [firmId, ids.carol])).rows.length === 1);
check("admin can't grant owner", failed(await as("carol", "insert into firm_members (firm_id, user_id, role) values ($1, $2, 'owner')", [firmId, ids.bob])));
check("admin adds a member", ok(await as("carol", "insert into firm_members (firm_id, user_id) values ($1, $2)", [firmId, ids.bob])));
check("admin can't demote the owner", (await as("carol", "update firm_members set role = 'member' where firm_id = $1 and user_id = $2 returning role", [firmId, ids.alice])).rows.length === 0);
check("last owner can't leave", failed(await as("alice", "delete from firm_members where firm_id = $1 and user_id = auth.uid()", [firmId])));
check("last owner can't demote themself", failed(await as("alice", "update firm_members set role = 'member' where firm_id = $1 and user_id = auth.uid()", [firmId])));
check("a member can leave", ok(await as("bob", "delete from firm_members where firm_id = $1 and user_id = auth.uid()", [firmId])));
check("admin deletes a company", (await as("carol", "delete from companies where name = 'Second' returning id")).rows.length === 1);

// create_firm RPC
const rpc = await as("bob", "select public.create_firm('Meridian') as id");
check("create_firm returns a firm its creator owns and can see", ok(rpc) && (await as("bob", "select name from firms where id = $1", [rpc.rows[0]?.id])).rows[0]?.name === "Meridian");
check("anon can't create firms", failed(await as("anon", "select public.create_firm('x')")));
check("no direct firm inserts", failed(await as("bob", "insert into firms (name) values ('x')")));

// Audit trail (third migration)
if (auditSql) {
  const write = (who) => as(who, "insert into audit_events (firm_id, company_id, actor_id, action, metadata) values ($1, $2, $3, 'room.invite_created', '{\"stakeholder\":\"founder\"}') returning id", [firmId, companyId, ids.alice]);
  check("audit: signed-in users can't write events", failed(await write("alice")));
  check("audit: the server can", ok(await write("service")));
  check("audit: firm owner reads the trail", (await as("alice", "select action from audit_events where firm_id = $1", [firmId])).rows.length === 1);
  await as("service", "update firm_members set role = 'member' where firm_id = $1 and user_id = $2", [firmId, ids.carol]);
  check("audit: a plain member can't read it", (await as("carol", "select id from audit_events")).rows.length === 0);
  await as("service", "update firm_members set role = 'admin' where firm_id = $1 and user_id = $2", [firmId, ids.carol]);
  check("audit: an admin can", (await as("carol", "select id from audit_events")).rows.length === 1);
  check("audit: outsiders can't", (await as("bob", "select id from audit_events")).rows.length === 0);
  check("audit: events can't be edited, even by the server", failed(await as("service", "update audit_events set action = 'x.y'")));
  check("audit: an attribution can't be rewritten to someone else", failed(await as("service", "update audit_events set actor_id = $1", [ids.bob])));
  check("audit: users can't delete events", (await as("alice", "delete from audit_events returning id")).rows.length === 0 && (await as("service", "select id from audit_events")).rows.length === 1);
  check("audit: malformed actions are refused", failed(await as("service", "insert into audit_events (firm_id, action) values ($1, 'DROP TABLE')", [firmId])));
  check("audit: oversized metadata is refused", failed(await as("service", "insert into audit_events (firm_id, action, metadata) values ($1, 'x.y', jsonb_build_object('blob', repeat('a', 4000)))", [firmId])));
}

// Realtime private channels (fourth migration)
if (files.some((f) => f.endsWith("_realtime_rooms.sql"))) {
  const topic = `company:${companyId}`;
  const send = (who, t = topic, extension = "broadcast") =>
    as(who, "insert into realtime.messages (topic, extension, payload) values ($1, $2, '{}') returning id", [t, extension], t);
  const listen = (who, t = topic) => as(who, "select id from realtime.messages where topic = $1", [t], t);
  check("realtime: a firm member can send to the company's channel", ok(await send("carol")));
  check("realtime: the owner can too, and both receive", ok(await send("alice")) && (await listen("carol")).rows.length === 2);
  check("realtime: an outsider can neither send nor receive", failed(await send("bob")) && (await listen("bob")).rows.length === 0);
  check("realtime: anon can't send", failed(await send("anon")));
  check("realtime: malformed topics are refused", failed(await send("alice", "company:not-a-uuid")) && failed(await send("alice", "firm:x")));
  check("realtime: only broadcast and presence", failed(await send("alice", topic, "postgres_changes")));
}

// Hardening: trigger functions aren't callable as RPCs, and the triggers still fire.
if (files.some((f) => f.endsWith("_hardening.sql"))) {
  const grants = await as(
    "service",
    `select count(*)::int as n from unnest(array['anon', 'authenticated']) r,
       unnest(array['public.companies_default_firm()', 'public.firms_delete_empty()', 'public.users_create_personal_firm()',
                    'public.firm_members_keep_owner()', 'public.audit_events_append_only()', 'public.set_updated_at()']) f
     where has_function_privilege(r, f, 'execute')`,
  );
  check("hardening: no API role holds EXECUTE on a trigger function", grants.rows[0]?.n === 0);
  check("hardening: the triggers still run (insert lands in a firm)", ok(await as("bob", "insert into companies (name) values ('After hardening') returning firm_id")));
}

// Firm invitations (fifth migration)
if (files.some((f) => f.endsWith("_firm_invites.sql"))) {
  const hash = (c) => c.repeat(64);
  const invite = (who, email, role, h, invitedBy) =>
    invitedBy
      ? as(who, "insert into firm_invites (firm_id, email, role, token_hash, invited_by) values ($1, $2, $3, $4, $5) returning id", [firmId, email, role, h, invitedBy])
      : as(who, "insert into firm_invites (firm_id, email, role, token_hash) values ($1, $2, $3, $4) returning id", [firmId, email, role, h]);
  check("invites: the owner invites a colleague by email", ok(await invite("alice", "bob@x.test", "member", hash("b"))));
  check("invites: an admin can invite an admin", ok(await invite("carol", "dan@x.test", "admin", hash("d"))));
  check("invites: nobody can invite straight to owner", failed(await invite("alice", "erin@x.test", "owner", hash("e"))));
  check("invites: an outsider can't invite into the firm", failed(await invite("bob", "x@x.test", "member", hash("f"))));
  check("invites: the inviter can't be forged", failed(await invite("alice", "y@x.test", "member", hash("9"), ids.carol)));
  check("invites: an outsider can't read them", (await as("bob", "select id from firm_invites")).rows.length === 0);
  const anonInvites = await as("anon", "select id from firm_invites");
  check("invites: anon can't read them", failed(anonInvites) || anonInvites.rows.length === 0);

  const preview = (who, h) => as(who, "select * from public.firm_invite_preview($1)", [h]);
  const p = (await preview("bob", hash("b"))).rows[0];
  check(
    "invites: the invitee previews the firm without seeing the address",
    p?.role === "member" && p?.email_matches === true && p?.expired === false && !("email" in (p ?? {})),
  );
  check("invites: someone else holding the link is told it isn't theirs", (await preview("dan", hash("b"))).rows[0]?.email_matches === false);
  check(
    "invites: anon can't preview or accept",
    failed(await preview("anon", hash("b"))) && failed(await as("anon", "select public.accept_firm_invite($1)", [hash("b")])),
  );

  const accept = (who, h) => as(who, "select public.accept_firm_invite($1) as firm", [h]);
  const role = async (who) => (await as(who, "select role from firm_members where firm_id = $1 and user_id = auth.uid()", [firmId])).rows[0]?.role;
  check("invites: a forwarded link doesn't work for a different account", failed(await accept("dan", hash("b"))));
  await db.query("update auth.users set email_confirmed_at = null where id = $1", [ids.bob]);
  check("invites: an unconfirmed email can't accept", failed(await accept("bob", hash("b"))));
  await db.query("update auth.users set email_confirmed_at = now() where id = $1", [ids.bob]);
  await as("service", "update firm_invites set expires_at = now() - interval '1 minute' where token_hash = $1", [hash("d")]);
  check("invites: an expired invitation can't be accepted", failed(await accept("dan", hash("d"))));
  check("invites: unknown links are refused", failed(await accept("bob", hash("c"))));
  check("invites: the invitee accepts and lands in the firm", (await accept("bob", hash("b"))).rows[0]?.firm === firmId);
  check("invites: with the invited role", (await role("bob")) === "member");
  check("invites: the link is spent", failed(await accept("bob", hash("b"))));
  check("invites: the new member sees the firm's companies", (await as("bob", "select id from companies where firm_id = $1", [firmId])).rows.length > 0);
  check("invites: a plain member can't invite", failed(await invite("bob", "z@x.test", "member", hash("8"))));

  await invite("alice", "bob@x.test", "admin", hash("7"));
  await accept("bob", hash("7"));
  check("invites: accepting again never changes an existing member's role", (await role("bob")) === "member");
  check("invites: an admin revokes an invitation", (await as("carol", "delete from firm_invites where token_hash = $1 returning id", [hash("d")])).rows.length === 1);

  const roster = await as("bob", "select email, role from public.firm_roster($1)", [firmId]);
  check(
    "roster: colleagues see each other's email and role, owners first",
    roster.rows.length === 3 && roster.rows[0]?.role === "owner" && roster.rows.some((r) => r.email === "bob@x.test"),
  );
  check("roster: outsiders get nothing", (await as("dan", "select * from public.firm_roster($1)", [firmId])).rows.length === 0);
  check("roster: anon can't call it", failed(await as("anon", "select * from public.firm_roster($1)", [firmId])));
  await as("bob", "delete from firm_members where firm_id = $1 and user_id = auth.uid()", [firmId]);
}

// Account deletion
await as("service", "update firm_members set role = 'owner' where firm_id = $1 and user_id = $2", [firmId, ids.carol]);
await db.query("delete from auth.users where id = $1", [ids.alice]);
const after = await as("service", "select owner_id from companies where id = $1", [companyId]);
check("deleting a co-owner's account keeps the firm's company (owner_id cleared)", after.rows.length === 1 && after.rows[0].owner_id === null);
await db.query("delete from auth.users where id = $1", [ids.dan]);
check(
  "deleting a sole owner's account removes their personal firm and its companies",
  (await as("service", "select id from firms where id = $1", [danFirm])).rows.length === 0 &&
    (await as("service", "select id from companies where name = 'Legacy Co'")).rows.length === 0,
);

// Sign-up after the migration: personal firm is created with the account.
const erin = "00000000-0000-0000-0000-00000000000e";
await db.query("insert into auth.users values ($1, 'erin@x.test')", [erin]);
ids.erin = erin;
check("a new advisor's very first company insert succeeds", ok(await as("erin", "insert into companies (name) values ('First') returning id")));

if (auditSql) {
  check("audit: events outlive the people they describe (actor cleared)", (await as("service", "select actor_id from audit_events")).rows[0]?.actor_id === null);
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
