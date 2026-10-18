/**
 * Multi-seat browser check: an owner, a colleague and an outsider, each in an
 * isolated Playwright context (separate cookies and storage, like separate
 * browser profiles), against a running app and the Supabase project in
 * .env.local. Covers /team, /join (incl. forwarded and spent links), roles,
 * shared companies, Decision Room presence and removal.
 *
 * Throwaway @example.test users are created via the admin API, signed in the
 * way the app does (@supabase/ssr cookies, not the login form), and always
 * deleted. Skips when Supabase isn't configured.
 *
 *   pnpm dev                     # in another terminal
 *   pnpm test:e2e                # BRIDGEGEN_BASE_URL defaults to http://localhost:3000
 *
 * Screenshots land in tests/e2e/output/ (gitignored).
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// localhost, not 127.0.0.1: Next blocks HMR for unlisted origins and the page reload-loops.
const BASE = (process.env.BRIDGEGEN_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "tests/e2e/output";
// next dev may never fire "load"; every step waits for its own content instead.
const NAV = { waitUntil: "domcontentloaded" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url.startsWith("https://") || publishable.length < 20 || secret.length < 20) {
  console.log("SKIP  Supabase isn't configured in .env.local");
  process.exit(0);
}
try {
  await fetch(BASE, { signal: AbortSignal.timeout(10_000) });
} catch {
  console.error(`App not reachable at ${BASE}. Start it with "pnpm dev" first.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const cookieDomain = new URL(BASE).hostname;

const run = randomUUID().slice(0, 8);
const password = `E2e-${randomUUID()}`;
const userIds = [];
const results = [];
const problems = [];
const check = (label, ok, extra = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
};

async function makeUser(label) {
  const email = `e2e-${label}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  // Sign in the way the app does (@supabase/ssr cookies) and hand the cookies to the browser.
  const jar = new Map();
  const client = createServerClient(url, publishable, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  const cookies = [...jar].map(([name, value]) => ({ name, value, domain: cookieDomain, path: "/", sameSite: "Lax" }));
  return { email, id: data.user.id, cookies };
}

async function profile(browser, label, user) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(user.cookies);
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on("pageerror", (e) => problems.push(`${label} pageerror: ${e.message}`));
  page.on("console", (m) => {
    // 404s are expected: the invalid-link checks request links that no longer exist.
    if (m.type() === "error" && !/Download the React DevTools|favicon|status of 404/.test(m.text())) problems.push(`${label} console: ${m.text().slice(0, 300)}`);
  });
  const p = { context, page, label, user };
  profiles.push(p);
  return p;
}

const shot = (p, name) => p.page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
const text = (p) => p.page.locator("main:visible").innerText();

let browser;
const profiles = [];
try {
  const ownerUser = await makeUser("owner");
  const colleagueUser = await makeUser("colleague");
  const outsiderUser = await makeUser("outsider");
  browser = await chromium.launch();
  const owner = await profile(browser, "owner", ownerUser);
  const colleague = await profile(browser, "colleague", colleagueUser);
  const outsider = await profile(browser, "outsider", outsiderUser);
  const firmName = `QA Harbor ${run}`;

  // 1. Owner opens /team and renames their personal firm.
  await owner.page.goto(`${BASE}/team`, NAV);
  await owner.page.getByText("Members", { exact: false }).first().waitFor();
  check("owner: /team shows the firm with themself as owner", (await text(owner)).includes(ownerUser.email) && (await text(owner)).includes("Owner"));
  await owner.page.getByRole("button", { name: "Rename firm" }).click();
  await owner.page.getByLabel("Firm name").first().fill(firmName);
  await owner.page.getByRole("button", { name: "Save name" }).click();
  await owner.page.getByText(firmName).first().waitFor();
  check("owner: renames the firm", true);

  // 2. Owner invites the colleague as a member and gets a one-time link.
  await owner.page.getByLabel("Email").fill(colleagueUser.email.toUpperCase());
  await owner.page.getByRole("button", { name: "Create link" }).click();
  const linkInput = owner.page.getByLabel("Invitation link");
  await linkInput.waitFor();
  const link = await linkInput.inputValue();
  check("owner: gets a /join link", /\/join\/[A-Za-z0-9_-]{43}$/.test(link), link.replace(/[A-Za-z0-9_-]{43}$/, "<token>"));
  await owner.page.getByText("Pending").waitFor();
  check("owner: pending list shows the (lower-cased) address", (await text(owner)).includes(colleagueUser.email));
  await shot(owner, "1-owner-invited");

  // 3. A different signed-in advisor opening the forwarded link is turned away.
  await outsider.page.goto(link, NAV);
  await outsider.page.getByText("sent to a different email address").waitFor();
  check("outsider: forwarded link is refused", true);
  await shot(outsider, "2-outsider-refused");

  // 4. Colleague previews and joins.
  await colleague.page.goto(link, NAV);
  await colleague.page.getByRole("button", { name: `Join ${firmName}` }).waitFor();
  check("colleague: sees the firm name and role", (await text(colleague)).includes("as a member"));
  await shot(colleague, "3-colleague-invite");
  await colleague.page.getByRole("button", { name: `Join ${firmName}` }).click();
  await colleague.page.waitForURL(/\/team\?firm=[0-9a-f-]{36}$/, NAV);
  // The joined firm opens directly (not the colleague's personal workspace).
  await colleague.page.getByText(ownerUser.email).waitFor();
  const colleagueTeam = await text(colleague);
  check("colleague: lands on the joined firm's /team, sees both members", colleagueTeam.includes(colleagueUser.email) && colleagueTeam.includes(firmName));
  check("colleague: in two firms, so a firm picker appears", (await colleague.page.getByLabel("Firm", { exact: true }).count()) === 1);
  check("copy: reads 'You're a member'", colleagueTeam.includes("You're a member"));
  check("colleague (member): no invite panel, no role controls", (await colleague.page.getByText("Invite a colleague").count()) === 0 && (await colleague.page.getByLabel(/^Role for/).count()) === 0);
  await shot(colleague, "4-colleague-team");

  // 5. Reusing the spent link fails.
  await outsider.page.goto(link, NAV);
  await outsider.page.getByText("This invitation isn't valid").waitFor();
  check("spent link is no longer valid", true);

  // 6. Owner sees the new member, promotes them to admin.
  await owner.page.reload(NAV);
  await owner.page.getByText(colleagueUser.email).first().waitFor();
  check("owner: pending invitation is gone", (await owner.page.getByText("Pending").count()) === 0);
  await owner.page.getByLabel(`Role for ${colleagueUser.email}`).click();
  await owner.page.getByRole("option", { name: "Admin" }).click();
  await owner.page.waitForTimeout(1500);
  await colleague.page.reload(NAV);
  await colleague.page.getByLabel("Firm", { exact: true }).click();
  await colleague.page.getByRole("option", { name: firmName }).click();
  await colleague.page.getByText("Invite a colleague").waitFor();
  check("colleague promoted to admin: invite panel appears", true);
  check("admin: no controls over the owner", (await colleague.page.getByLabel(`Role for ${ownerUser.email}`).count()) === 0 && (await colleague.page.getByLabel(`Remove ${ownerUser.email}`).count()) === 0);
  await shot(colleague, "5-colleague-admin");

  // 7. Shared companies: owner creates one, colleague sees it under the firm.
  const companyName = `QA Shared Co ${run}`;
  await owner.page.goto(`${BASE}/companies`, NAV);
  await owner.page.getByLabel("Company name").fill(companyName);
  await owner.page.getByRole("button", { name: "Create" }).click();
  await owner.page.waitForURL(`${BASE}/simulator`, NAV);
  await colleague.page.goto(`${BASE}/companies`, NAV);
  await colleague.page.getByText(companyName).waitFor();
  check(
    "colleague: sees the owner's company, grouped under the firm, with a firm picker",
    (await colleague.page.getByRole("heading", { name: firmName }).count()) === 1 && (await colleague.page.getByLabel("Firm", { exact: true }).count()) === 1,
  );
  await shot(colleague, "6-colleague-companies");

  // 8. Live presence: both open the company's Decision Room.
  await colleague.page.locator("li", { hasText: companyName }).getByRole("button", { name: "Open" }).click();
  await colleague.page.waitForURL(`${BASE}/simulator`, NAV);
  await owner.page.goto(`${BASE}/room`, NAV);
  await colleague.page.goto(`${BASE}/room`, NAV);
  const peers = (p) => p.page.getByRole("list", { name: "Colleagues here" });
  try {
    await peers(owner).waitFor({ timeout: 45_000 });
    await peers(colleague).waitFor({ timeout: 45_000 });
    check("live: each sees the other in the Decision Room", true);
  } catch {
    check("live: each sees the other in the Decision Room", false, (await owner.page.locator("[aria-live=polite]").first().innerText().catch(() => "no status")).trim());
  }
  await shot(owner, "7-owner-room-presence");

  // 9. Owner removes the colleague; colleague loses access to the shared company.
  await owner.page.goto(`${BASE}/team`, NAV);
  await owner.page.getByLabel(`Remove ${colleagueUser.email}`).click();
  await owner.page.getByRole("button", { name: "Remove", exact: true }).click();
  await owner.page.waitForTimeout(1500);
  check("owner: colleague removed from the roster", !(await text(owner)).includes(colleagueUser.email));
  await colleague.page.goto(`${BASE}/companies`, NAV);
  await colleague.page.getByText("Client companies").waitFor();
  await colleague.page.waitForTimeout(2500);
  check("removed colleague: shared company no longer listed", !(await text(colleague)).includes(companyName));
  await shot(colleague, "8-colleague-removed");
} catch (error) {
  check("script ran to completion", false, error.message.split("\n")[0]);
  console.log("at:", error.stack.split("\n").find((l) => l.includes("multiseat")));
  for (const p of profiles) {
    await p.page.screenshot({ path: join(OUT, `fail-${p.label}.png`), fullPage: true }).catch(() => {});
    console.log(`--- ${p.label} @ ${p.page.url()}\n` + (await p.page.locator("body").innerText().catch(() => "?")).slice(0, 700));
  }
} finally {
  await browser?.close();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  console.log(`cleanup: deleted ${userIds.length} test users`);
  if (problems.length) console.log("\nBrowser errors:\n" + [...new Set(problems)].join("\n"));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
