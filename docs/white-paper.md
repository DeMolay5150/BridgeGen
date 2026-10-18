# BridgeGen: Technical and Architectural White Paper

**Private Company Decision Simulator.** *See the systemic consequences before you make the decision.*

Version 1.0 · October 2026 · Production: https://www.bridgegen.io

---

## Abstract

BridgeGen is a decision simulator for advisors to family-owned and founder-led private companies: multi-family offices, private banks, CPAs, M&A advisors and estate attorneys. It models capital allocation, succession, governance debt and stress scenarios, and lets several stakeholders state confidential positions whose disagreements are surfaced without revealing who said what.

This paper describes three things:

1. **The enterprise transformation.** BridgeGen was audited against ten open-source reference projects and adopted each one's architectural *pattern*, sometimes substituting a lighter implementation that fits the stack.
2. **The multi-tenant firm architecture.** Advisory firms are isolated workspaces with owner/admin/member roles, email-bound invitations and an append-only audit trail.
3. **The zero-trust Supabase integration.** Every layer (browser, route handler, policy engine, Postgres row-level security, Realtime authorization) verifies the request independently, and no layer trusts what the one above it says.

Where the system has known gaps, they are stated in section 9 rather than left out.

---

## 1. Design principles

| Principle | What it means in the code |
| --- | --- |
| **Glass-box, deterministic numbers** | Every headline figure comes from a pure engine in `lib/` and has a deterministic explainer in `lib/explain/`. No language model produces numbers. |
| **The database is the hard boundary** | Row-level security (RLS) decides visibility. The application layer can only narrow what Postgres already allows, never widen it. |
| **Default deny** | Policies are allow-lists. An action that isn't listed for a role is refused. |
| **Confidentiality by construction** | Raw Decision Room answers never leave the server. Advisors receive only derived gaps. |
| **Untrusted input everywhere** | Request bodies, saved rows and live-channel payloads all pass the same Zod schemas before use. |
| **Refusals don't leak** | An unauthorized request gets `404 Not found`, so a refusal never confirms that a resource exists. |
| **Works without a backend** | With no Supabase keys set, the app runs as an in-memory public demo and nothing breaks. |

---

## 2. System overview

### 2.1 Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Cache Components, `proxy.ts` session refresh), React 19.3, TypeScript strict |
| UI | Tailwind CSS v4 (CSS-first tokens), shadcn/ui `base-nova` on Base UI, Lucide, Geist Sans/Mono |
| State | Zustand 5 (one store shared by every module) |
| Visualization | Recharts 3, React Flow (`@xyflow/react` 12) |
| Documents | `@react-pdf/renderer` 4.9, `pptxgenjs` 4.0, Marp-flavoured Markdown |
| Data, auth, realtime, storage | Supabase: Postgres + RLS, Auth, Realtime private channels, Storage |
| Validation | Zod 4 |
| Hosting | Vercel (Git-connected to `main`), custom domain `www.bridgegen.io` |
| Video | Remotion 4 (separate package in `video/`) |

### 2.2 Modules

| Route | Module |
| --- | --- |
| `/simulator` | Capital Allocation Flight Simulator, Economics vs. Alignment matrix, three-statement model with Monte Carlo |
| `/governance` | Governance Debt calculator (score 0–100 and dollars at risk) |
| `/fork` | Fork the Future: two branches projected over 1, 3, 5 and 10 years |
| `/room` | Decision Room: stakeholder views, confidential questionnaire, ownership and voting map, live presence |
| `/red-team` | Red Team stress tests and breaking points |
| `/present` | Client-safe presentation mode |
| `/companies`, `/team`, `/join/[token]` | Firm workspace: companies, members, invitations |
| `/respond/[token]` | Stakeholder questionnaire reached by invite link |
| `/walkthrough` | Product video streamed from Supabase Storage |

### 2.3 Code layout

```
app/                 routes and route handlers (app/api/**)
components/          UI, one folder per module
lib/<engine>/        pure, tested engines: simulator, governance, projection,
                     statements, finance, redteam, room, explain, narrative
lib/authz/           policy engine (resource × action → derived role)
lib/audit/           server-only audit writer
lib/realtime/        live-room client and wire protocol
lib/persistence/     schemas that validate and default-merge saved rows
lib/supabase/        browser, server (as the user) and admin clients
supabase/migrations/ schema, RLS, functions and triggers
tests/               migrations (PGlite), rls (live), e2e (Playwright)
```

---

## 3. The enterprise transformation: ten reference patterns

BridgeGen was audited against ten open-source projects in two passes (Phases 5 and 6) and re-audited in Phase 8. The goal was to adopt each project's architectural *pattern*, not its code. Where a dependency would add a vendor, a service or an incompatibility, an equivalent was built on the existing stack and recorded as a substitution.

| # | Reference | Pattern adopted | Implementation in BridgeGen |
| --- | --- | --- | --- |
| 1 | **shadcn/ui** | Owned, composable primitives with semantic design tokens | `base-nova` components on Base UI; tokens such as `positive`, `caution`, `metric` and `critical` defined once in `app/globals.css`; a Dialog primitive added for export flows |
| 2 | **Tremor** | KPI cards that show change, not just level | Delta-vs-Today badges on Simulator cards; sparkline and delta on Fork branch cards; one shared delta type (`lib/domain/delta.ts`) feeding UI, PDF and decks |
| 3 | **FinRobot** | Analyst structure: data → analysis → thesis → actions | Deterministic "bottom line up front" executive briefs (`lib/narrative/`) for Red Team and Governance. FinRobot's structure is used **without model calls**, to keep the glass-box rule. |
| 4 | **taxonomy** | Workspace tenancy and hardened route handlers | Multi-seat firms with RLS (section 4); JSON-only, same-origin checks on every mutating route (section 5.3) |
| 5 | **react-pdf** | Server-quality documents from React | Multi-page branded PDF report with shared chrome (header, numbered footer, optional watermark), lazy-loaded |
| 6 | **xyflow (React Flow)** | Node-graph canvases | Ownership cascade and governance voting tree in the Decision Room |
| 7 | **Finance engines** (cash-flow and statement models) | Linked financial statements and probabilistic outcomes | `lib/statements`: income statement, balance sheet and cash flow that balance every year, plus seeded Monte Carlo; liquidity and covenant alerts |
| 8 | **finance.ts / ReactGrid** | Finance primitives and spreadsheet interop | `lib/finance`: NPV, IRR, XIRR, WACC and amortization, tested against known values. *Substitution:* native TSV copy/paste to Excel, because ReactGrid 4 doesn't support React 19. |
| 9 | **Liveblocks / Cerbos** | Multiplayer presence; policy-based authorization | *Substitutions:* Supabase Realtime private channels for presence, cursors and sync (no new vendor or key); an in-process Cerbos-style policy table in `lib/authz` (no extra service) |
| 10 | **Marp** | Decks as code | Investment-committee and Red Team decks exported client-side as `.pptx`, `.pdf` and Marp-flavoured `.md`. *Substitution:* client-side generation instead of Marp CLI, which needs headless Chromium on the server. |

Each substitution keeps the interface of the original pattern, so it can be swapped for the reference implementation later without touching callers.

### 3.1 Findings fixed during the audits

The audits also caught defects that a feature-only pass would have missed:

- **Cross-site request forgery shape.** Mutating routes accepted any `Content-Type`, so a cross-site `text/plain` form could carry a body that parses as JSON. Fixed by `guardMutation()` (section 5.3).
- **Silent data desync.** Three-statement inputs lived in component state, so Fork, Red Team and the deck silently used defaults, and edits were lost on navigation. They now live in the shared store (`fork.statements`), are saved with the company, and are read everywhere through `statementAssumptions()`.
- **Silent refusals.** A member deleting a colleague's company saw it reappear, because RLS returns zero rows rather than an error. The UI now explains the refusal.
- **Build integrity.** Untracked reference clones were swept into type-checking and linting. They are excluded and gitignored.

---

## 4. Secure multi-tenant firm architecture

### 4.1 Tenancy model

```
auth.users ──< firm_members >── firms ──< companies ──< room_invites
                 (role)                     │               room_responses (server-only)
                                            └──< audit_events (append-only)
firms ──< firm_invites (hashed, email-bound, 7-day)
```

- **Firm = tenant.** Every advisor gets a personal firm at sign-up (trigger `users_create_personal_firm`). Further firms are created through `create_firm()`.
- **Roles:** `owner > admin > member`.
- **Companies belong to a firm** (`companies.firm_id`). All members of that firm can see them, and nobody else can. A trigger assigns new companies to the creator's personal firm by default.
- **A firm always keeps an owner.** Trigger `firm_members_keep_owner` refuses to remove or demote the last owner. Firms left with no members are deleted (`firms_delete_empty`).

### 4.2 Row-level security

Every table has RLS enabled, and `anon` privileges are revoked. Membership checks go through two helpers:

- `is_firm_member(firm_id)` returns whether the caller belongs to the firm.
- `firm_role(firm_id)` returns the caller's role in it.

Both are `STABLE SECURITY DEFINER` with `search_path = ''`, and only `authenticated` may execute them.

| Table | Read | Write |
| --- | --- | --- |
| `firms` | Members | Rename: owners and admins. Delete: owners. |
| `firm_members` | Members see colleagues | Add and change roles: owners and admins (admins never touch owners). Remove: owners and admins; anyone may leave. |
| `companies` | Firm members | Create and update: members. Delete: the creator, owners and admins. |
| `room_invites` | Firm members | Firm members |
| `room_responses` | **Nobody** through the API | **Nobody** through the API (RLS on, no policies, privileges revoked from `anon` and `authenticated`) |
| `firm_invites` | Owners and admins | Owners and admins; `invited_by` must equal `auth.uid()` |
| `audit_events` | Owners and admins of the firm | Nobody through the API; append-only trigger blocks update and delete |

The membership helpers are `STABLE`, so a statement must never create a membership whose RLS check depends on that same membership. Invitation acceptance is built around this rule.

### 4.3 Email-bound invitations

Colleagues join a firm only by accepting an invitation (migration `20261017120000_firm_invites.sql`):

1. An owner or admin invites an email address. The server generates 32 random bytes (base64url) and stores only its **SHA-256 hash**. The raw link exists once, in the inviter's hands.
2. The link (`/join/<token>`) expires after **7 days**. There is one live invitation per person per firm; re-inviting replaces the link.
3. `firm_invite_preview()` tells the accept page the firm name, the role and whether the link has expired. It returns **whether the caller's email matches, never the invited address**.
4. `accept_firm_invite()` does everything in one locked statement: it checks that the link exists and hasn't expired, that the caller is signed in **with that same confirmed email address**, then adds the membership and deletes the invitation. A forwarded or leaked link is useless to anyone else.
5. **Invitations grant `admin` or `member`, never `owner`.** Owners promote colleagues after they join.
6. Inviting never reveals whether an email already has an account.

Colleagues' email addresses come only from `firm_roster()`. It exposes one column of `auth.users`, to members of that firm only.

### 4.4 Policy engine on top of RLS

`lib/authz/policy.ts` is a Cerbos-style declarative table: resource × action → derived roles, default deny.

```ts
export const COMPANY_POLICY: Record<CompanyAction, DerivedRole[]> = {
  read: ANY_MEMBER,
  update: ANY_MEMBER,
  delete: ["firm_owner", "firm_admin", "company_creator"],
  "room:view_gaps": ANY_MEMBER,
  "room:invite": ANY_MEMBER,
  "room:rotate_invite": ["firm_owner", "firm_admin", "company_creator"],
  "report:export": ANY_MEMBER,
};
```

- **Derived roles** come from the principal and the resource. For example, `company_creator` applies only while the creator is still a firm member.
- **Every decision carries a reason**, either the role that granted it or what was missing, so it can be explained and audited.
- **Firm actions** use `FIRM_POLICY`, `invitableRoles()` and `canChangeMember()`, which mirror the `firm_members` RLS policies. The last-owner rule stays in the database trigger, the only place that sees the whole roster.
- **The table is kept in step with RLS** and tested on both sides: unit tests for the policy and PGlite tests for the SQL.

### 4.5 Audit trail

`recordAudit()` (`lib/audit/server.ts`, server-only) appends to `audit_events`. It records:

- Decision Room invites, rotations, submissions and reopenings;
- report and deck exports;
- firm creation and renaming;
- invitations, joins, role changes, removals and departures.

Events are scoped to a firm. Company events look up their firm from the company.

**Metadata never contains stakeholder answers.** Writes are best effort: an audit failure is logged and never fails the action it describes. The table is append-only at the database level.

---

## 5. Zero-trust Supabase integration

"Zero trust" here means a specific engineering property: **no layer grants access because of where a request came from or what an upstream layer decided.** Each layer authenticates the caller and re-checks authorization with what it can see. It is a design stance, not a certification.

### 5.1 Request path

```
Browser (publishable key + session cookie, never the secret key)
  │
  ▼
Vercel edge: TLS, HSTS, security headers
  │
  ▼
proxy.ts: refreshes the Supabase session cookie
  │
  ▼
Route handler (app/api/**)
  ├─ guardMutation(): JSON-only, same-origin, size limit
  ├─ Zod schema: strict body validation (errors never echo input)
  ├─ authorize(id, action): RLS-visible row + policy decision → else 404
  │
  ▼
Supabase as the user (server client, cookies) ── Postgres RLS: the hard boundary
  │
  └─ admin client (secret key, server-only), used only after authorize()
       for room_responses, token lookups and audit writes
```

### 5.2 Three clients, three trust levels

| Client | Key | Where | Used for |
| --- | --- | --- | --- |
| `lib/supabase/client.ts` | Publishable | Browser | Auth, own data under RLS, Realtime |
| `lib/supabase/server.ts` | Publishable + user cookies | Server | Everything a user does, **as that user**, under RLS |
| `lib/supabase/admin.ts` | Secret (`server-only` import guard) | Route handlers | Confidential reads and writes, **only after `authorize()`** |

The secret key is a Vercel *sensitive* environment variable and is never sent to the browser. The `server-only` guard makes the build fail if the admin client is imported into client code.

### 5.3 Route hardening

Every state-changing route reads its body through `readBody()`:

- **`application/json` required.** This forces a CORS preflight for cross-site requests; otherwise the route returns 415.
- **`Origin` must be ours when present**, otherwise 403. Session cookies are also `SameSite=Lax`, so this is defence in depth, and it covers the token-only stakeholder route, which has no session.
- **Body size is capped before parsing** (413).
- **Strict Zod schemas.** Error messages never echo submitted values.
- **Authorization returns null on any failure, and the route answers 404.** A refusal looks exactly like a missing resource.

### 5.4 Confidential Decision Room

The central confidentiality guarantee is that **raw stakeholder answers never leave the server:**

- Stakeholders reach the questionnaire only through a per-stakeholder link (`/respond/<token>`). The token is stored as a SHA-256 hash and can be rotated, which disables the old link.
- Answers are written to `room_responses`, which no API role can read or write. Only the server's admin client touches it, after the token or the advisor's authorization has been checked.
- Advisors call the gaps endpoint, which returns only `detectGaps()` output: disagreements (spread ≥ 2) and misperceptions (prediction error ≥ 2), never individual answers.
- PDF reports, decks, audit metadata and live sync exclude answers by design.

### 5.5 Realtime authorization

Live Decision Rooms use one **private** channel per company, `company:<uuid>`, for presence, cursors and last-write-wins sync of decision inputs (never answers).

- RLS on `realtime.messages` admits `select` and `insert` for broadcast and presence **only** when `can_use_company_channel(topic)` is true. The topic must match `company:<uuid>` exactly, and the caller must belong to that company's firm.
- **Every inbound payload is untrusted.** Any firm member's browser can send anything, so payloads are parsed with the same schemas as saved rows (`lib/realtime/protocol.ts`) before they touch state.
- Verified in production: an anonymous join of a company channel is refused with `Unauthorized: You do not have permissions to read from this Channel topic`.

### 5.6 Browser and transport hardening

Every response carries:

- `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin` (tightened to `no-referrer` on the invite pages, so tokens don't leak in `Referer`)
- `Permissions-Policy`, denying camera, microphone, geolocation, payment, USB and topics
- `Strict-Transport-Security: max-age=63072000` (from Vercel)

`X-Powered-By` is disabled. Post-login redirects accept only a safe, same-site `?next=` (`lib/safe-next.ts`).

Supabase Auth redirects are allow-listed to `https://www.bridgegen.io/**`. Foreign redirect targets fall back to the Site URL, which is verified by generating and following real magic links.

### 5.7 Database function hygiene

- `SECURITY DEFINER` functions set `search_path = ''`, use fully qualified names, revoke `EXECUTE` from `public` and `anon`, and check `auth.uid()` or membership themselves.
- Trigger functions have `EXECUTE` revoked from every API role (migration `20261017090000_hardening.sql`). Triggers still fire, but the functions can't be called directly.
- The Supabase security advisor's remaining notices are the intended RPCs, each of which checks the caller itself.

---

## 6. Data integrity and persistence

- **Validated persistence.** `lib/persistence/serialize.ts` validates each saved row and merges it with defaults, so older rows load safely after the schema grows. `components/session-sync.tsx` autosaves the open company.
- **One source of truth on the client.** All modules share one Zustand store. Derived values such as simulation results, statements and gaps are recomputed from inputs, never stored separately.
- **Deterministic engines.** Engines are pure functions with hand-checked tests. Explainers build their steps from engine outputs rather than recomputing them a different way, so the explanation can't disagree with the number. Monte Carlo is seeded, so results are reproducible.

---

## 7. Verification

| Suite | Command | Scope | Status (Oct 2026) |
| --- | --- | --- | --- |
| Unit | `pnpm test` | Engines, policy, schemas, route guards, protocol | 271 tests, 29 files, passing |
| Migrations | `pnpm test:migrations` | Applies every migration to in-process Postgres (PGlite) and checks RLS, triggers and RPCs, including mutation-checked email gating | 79 checks, passing |
| Live RLS | `pnpm test:rls` | Against the real Supabase project, plus API routes when `BRIDGEGEN_BASE_URL` is set | 20/20 against production |
| Browser | `pnpm test:e2e` | Three isolated Playwright contexts: `/team`, `/join` (including forwarded and spent links), roles, shared companies, live presence, removal; throwaway users created and deleted | 18/18 |
| Static | `pnpm type-check`, `pnpm lint`, `pnpm build` | Strict TypeScript, ESLint, production build | Green |

Every migration runs through PGlite before any `db push`, and the dry run and the real push are separate, reviewed steps. Every new table needs RLS and a matching test in `tests/rls/`.

---

## 8. Deployment and operations

- **Vercel project** `bridge-gen`, Git-connected to `DeMolay5150/BridgeGen` `main`. Each push builds and deploys to production.
- **Domains:** `www.bridgegen.io` is canonical (CNAME at Porkbun). `bridgegen.io` redirects with a 308.
- **Production environment:** Supabase URL, publishable key, secret key (sensitive) and `NEXT_PUBLIC_SITE_URL`.
- **Media:** the walkthrough video and poster are served from a public Supabase Storage bucket (`media`). Anonymous writes are refused and range requests work. The files are kept out of Git.
- **Schema changes** go through `supabase/migrations/`, are tested in PGlite, dry-run, then pushed.

---

## 9. Known limitations and open items

| Item | Status | Impact |
| --- | --- | --- |
| **Realtime "Allow public access" not enforced** | Off in the dashboard, but public channel joins are still accepted. No `PrivateOnly` rejection, even after a fresh Realtime tenant start. Raised as a Supabase support case. | Company channels remain protected by RLS, so no data is exposed. The project can be used as a message relay, which counts against quota. |
| **Email delivery (SMTP)** | Not configured. "Confirm email" is off and invitation links are copied by hand. | The email-bound invitation check relies on confirmed emails, so turning confirmation on with SMTP is required before general launch. |
| **Leaked-password protection** | Requires the Supabase Pro plan. | Weak or breached passwords aren't screened at sign-up. |
| **CSP scope** | Framing, base and plugins only. No `script-src` or `connect-src` policy yet. | A full policy would need nonces for Next's inline scripts and allowances for Supabase websockets and Storage. |
| **Audit writes are best effort** | Failures are logged, not surfaced. | An outage of the audit table loses events rather than blocking work. |
| **Billing** | Stripe plans, limits and trials not built. Pricing shows unbuilt features as "Coming soon". | Commercial, not security. |

---

## 10. Roadmap

1. Resolve the Realtime public-access case with Supabase and re-verify: the public relay should be blocked, and private channels still refused to outsiders.
2. Custom SMTP; turn email confirmation on; send invitation emails; verify a confirmation email end to end.
3. Upgrade to Supabase Pro for leaked-password protection.
4. Nonce-based `script-src` and `connect-src` CSP.
5. Stripe billing with plan limits enforced server-side through the policy table.
6. Walkthrough voice-over; Remotion company licence.

---

## Appendix A: Migration history

| Migration | Purpose |
| --- | --- |
| `20261012190000_init.sql` | Companies, room invites, server-only room responses, owner RLS |
| `20261014090000_firms.sql` | Firms, members, roles, personal firms, firm-scoped company RLS, last-owner and empty-firm triggers |
| `20261015090000_audit_log.sql` | Append-only `audit_events`, owner/admin read |
| `20261016090000_realtime_rooms.sql` | RLS on `realtime.messages` for private `company:<uuid>` channels |
| `20261017090000_hardening.sql` | `EXECUTE` revoked on trigger functions |
| `20261017120000_firm_invites.sql` | Email-bound hashed invitations, `firm_roster`, `firm_invite_preview`, `accept_firm_invite` |

## Appendix B: Further reading in the repository

- `instructions.md`: stack, Supabase conventions and the design system
- `tasks/todo.md`: the full implementation roadmap and open items
- `PRICING.md`: go-to-market and plans
- `WALKTHROUGH-SCRIPT.md`: product walkthrough
