# BridgeGen Implementation Roadmap

## Phase 1: Environment & Workspace Setup
- [x] Task 1.1: Initialize Next.js 16 app with TypeScript, Tailwind CSS, and App Router (upgraded from 14: end-of-life with unpatched critical CVEs)
- [x] Task 1.2: Configure `CLAUDE.md`, state file connectors, and Git repository
- [x] Task 1.3: Set up shadcn/ui component library with "Quiet Luxury" dark theme

## Phase 2: Decision Laboratory Engine
- [x] Task 2.1: Build Capital Allocation Flight Simulator with interactive sliders
  - Route `/simulator`; editable demo company baseline (revenue, EBITDA, multiple, debt, rate, founder %)
  - Levers: debt leverage 0–6x, equity transfer 0–100%, multiple shock ±40%, outside CEO (cost + EBITDA uplift)
  - Outputs: EV, equity value, dividend recap / capital required, interest coverage, ownership split, risk signals
  - Pure engine `lib/simulator/engine.ts` (22 Vitest tests); inputs in Zustand store, results derived via `simulate()`
  - Out of scope: taxes, discounting, multi-year projections (2.4), governance scoring (2.3)
- [x] Task 2.2: Implement "Economics vs. Alignment" dual-matrix chart
  - On `/simulator` below results: Recharts scatter (0–100 axes, 4 quadrants) + stakeholder support bars
  - Alignment derived from levers: Founder / Next-gen heir / Board / Lender support (weights in `lib/simulator/alignment.ts`), consensus = mean − 0.5 × spread
  - Plots live scenario, Today and 4 strategy presets (`lib/simulator/strategies.ts`); click a dot or button to load it
  - 10 Vitest tests (hand-calculated presets, monotonicity, 0–100 bounds)
- [x] Task 2.3: Build "Governance Debt" calculation module
  - Route `/governance` + site nav; 9 weighted items across authority / board / voting → score 0–100
  - $ at risk = EV × 30% × score/100, itemized "recover $X by fixing"; demo company 78/100 → $22.5M
  - Cascades: risk signal in simulator (caution ≥30, critical ≥60); resilience × (1 − 0.5 × score/100) in the matrix
  - Model in `lib/governance/model.ts` (9 tests) + cascade tests in engine/alignment suites
- [x] Task 2.4: Implement "Fork the Future" side-by-side branch comparison
  - Route `/fork`: two branches (Today / Your scenario / preset + "Fix governance"), shared growth & cash-conversion assumptions
  - Yearly projection (`lib/projection/model.ts`): FCF pays down debt then dividends; shortfalls borrowed; governance crisis odds compound at 8% × score/100 per year
  - Shareholder value line chart, who's-ahead strip at 1/3/5/10y, horizon detail table
  - 18 Vitest tests; demo: fixing governance is worth +$20.3M by year 10, a dividend recap trails Today by $12.4M

## Phase 4: System of Record
- [x] Task 4.1: Supabase persistence and auth — migration applied to project `ahujzemhtytbiyuemuyy`; `pnpm test:rls` 9/9 against the live project incl. an end-to-end confidential room run (2026-10-12)
  - Open before launch: turn "Confirm email" back on with custom SMTP (`NEXT_PUBLIC_SITE_URL` is set in production: https://www.bridgegen.io)
- [x] Task 4.2: Go-to-market pricing strategy (`PRICING.md`) and `/pricing` page (Section 10 copy, billing toggle, ROI calculator, comparison, FAQ)
  - Prices live in `lib/pricing/plans.ts`; unbuilt capabilities show "Coming soon"
  - Open: billing/plan limits (Stripe), real trial mechanics, `NEXT_PUBLIC_SALES_CONTACT_URL` for sales CTAs
  - Email + password advisor accounts; `/companies` with autosave; public demo unchanged when signed out
  - Confidential Decision Room: per-stakeholder invite links (`/respond/[token]`), server-only answers, gaps-only API
  - Migrations in `supabase/migrations/`; RLS verified by `tests/rls/`

## Phase 3: Governance & Stress-Testing
- [x] Task 3.1: Build multi-stakeholder "Decision Room" (Founder vs Heir vs Board views)
  - Route `/room`: tabs for Founder, Next-gen heir, Board, Lender + Facilitator (inactive tabs unmount)
  - Each view: support score + drivers, role KPIs, 7 priority sliders that replace matrix weights app-wide
  - Private 6-topic questionnaire: own position + prediction of another stakeholder; "Submit & hide"
  - `detectGaps` (`lib/room/gaps.ts`): disagreements (spread ≥2) and misperceptions (|prediction − actual| ≥2), never exposing raw answers
  - In-memory only; true per-person confidentiality awaits Supabase auth + RLS
  - 20 new Vitest tests (gaps, priorities, room store)
- [x] Task 3.2: Implement "Red Team Mode" emergency stress-testing scenarios
  - Route `/red-team` attacks the live simulator scenario, with Today alongside
  - Shocks (`lib/redteam/shocks.ts`): founder incapacitation, successor exit (debt-funded heir buyout), downturn, perfect storm — each scaled by the matching governance gaps, with a "governance dividend" re-run
  - Breaking points (`lib/redteam/breaking.ts`): closed-form EBITDA / multiple declines that breach 2x coverage, 5x leverage or wipe out equity
  - 17 Vitest tests; demo: incapacitation costs $30.5M today, $21.2M of it avoidable with documented authority
- [x] Task 3.3: Implement "Explain This Decision" glass-box logic cards
  - Deterministic explainers (`lib/explain/`): cascade steps built from engine outputs, with real figures
  - Lever attribution: re-run with each lever reset to today; interactions reported as their own row
  - Explain popovers on simulator metrics, matrix scores, governance score, fork 10-year gap, red-team shocks
  - 21 Vitest tests (hand-checked text, attribution sums, headline consistency)

## Phase 5: Enterprise Upgrade (audit against shadcn/ui, Tremor, FinRobot, taxonomy, react-pdf)
Audit (2026-10-14), baseline 152 tests / type-check / lint green:
- Bug: `components/companies/company-list.tsx` has double-encoded UTF-8 ("Loadingâ€¦") in two places.
- shadcn: inputs/sliders/selects/popovers already on base-nova; no Dialog primitive yet (needed for the export flow).
- Tremor: KPI cards show absolute values only (no delta vs. Today, no sparklines); Fork branch cards show no trend.
- FinRobot: no LLM anywhere (glass-box rule: no AI-generated numbers). Red Team / Governance have step lists but no
  "bottom line up front" executive summary. Adopt FinRobot's *structure* (data → analysis → thesis → actions)
  deterministically; no model calls.
- taxonomy: RLS is single-owner only, no firm/workspace tenancy. Mutating routes accept any Content-Type
  (cross-site text/plain form bodies parse as JSON) and don't check Origin.
- react-pdf: no export.

- [x] Task 5.1: Fix mojibake in company list
- [x] Task 5.2: Deterministic M&A-banker executive briefs (`lib/narrative/`) for Red Team + Governance, with tests; brief card on both pages
- [x] Task 5.3: Tremor-style KPI cards: delta-vs-Today badges in the simulator; sparkline + delta on Fork branch cards
- [x] Task 5.4: shadcn Dialog + "Export executive summary" dialog in the Decision Room
- [x] Task 5.5: `@react-pdf/renderer` multi-page branded PDF (cover/BLUF, capital allocation, governance, red team, room gaps; never raw answers); lazy-loaded
- [x] Task 5.6: Route hardening: JSON-only + same-origin checks on mutating routes, tested
- [x] Task 5.7: Multi-seat firms migration (firms, firm_members, companies.firm_id, membership RLS) + RLS tests. Verified in PGlite (34 scenarios); NOT yet pushed to the live project (needs sign-off), so `pnpm test:rls` fails until `db push`
  - Next: firm invite flow (add colleagues by email via a server route), firm switcher for new companies (they default to the personal firm)

## Phase 6: Engines, Canvases, Multiplayer & Decks (patterns 6–10)
Audit (2026-10-14), baseline 174 tests green:
- No visual graph of ownership or governance; Decision Room is forms + lists.
- No financial statements: `lib/projection` is a single-line cash sweep (EBITDA × conversion). No IS/BS/CF, no balance check, no probabilistic view.
- No finance primitives: NPV/IRR/XIRR/WACC/amortization absent; interest is flat `debt × rate`. Nothing copies to Excel.
- No realtime, no permission layer beyond RLS, no audit trail.
- Red Team exports nothing presentation-shaped.

Substitutions (same pattern, fewer moving parts; each swappable later):
- Liveblocks → Supabase Realtime presence/broadcast on private channels (already our auth + RLS; no new vendor or key).
- Cerbos → in-process Cerbos-style policy (resource × action × derived role → effect) in `lib/authz`, no extra service.
- ReactGrid → native TSV clipboard (ReactGrid 4 doesn't support React 19).
- Marp CLI (needs headless Chromium) → client-side .pptx (pptxgenjs), .pdf (react-pdf) and Marp-flavoured .md.

- [x] Task 6.1: `lib/finance`: NPV, IRR, XIRR, WACC, amortization schedules (finance.ts conventions), tested against known values
- [x] Task 6.2: `lib/statements`: linked 3-statement engine (balances every year) + seeded Monte Carlo; Simulator panel with statements, distribution, explainer; Excel copy/paste (TSV)
- [x] Task 6.3: React Flow map in the Decision Room: ownership cascade + governance voting tree
- [x] Task 6.4: Red Team deck: .pptx / .pdf / Marp .md
- [x] Task 6.5: Policy engine + audit log (migration, server-written) wired into room routes
- [x] Task 6.6: Decision Room presence, live cursors and scenario sync over Supabase Realtime private channels
  - Verified with a fake channel (16 tests, echo-suppression mutation-checked) and PGlite RLS; not yet end-to-end with two live browsers (needs the firms + realtime migrations pushed and two advisor accounts)
- [x] Migrations firms / audit_log / realtime_rooms applied to `ahujzemhtytbiyuemuyy` (2026-10-14); live `pnpm test:rls` 12 passed, 4 API-route tests skipped (dev server not started)
- Open (Supabase support): Realtime "Allow public access" is off in the dashboard but not enforced. See "Supabase support case" under Open items before launch.
- Blocked: leaked-password protection (HaveIBeenPwned) needs the Supabase Pro plan; the BridgeGen org is on Free (checked 2026-10-17)

## Phase 7: Client delivery (presentation mode, IC deck, liquidity alerts, walkthrough)
Note: BridgeGen is one repository; "across the 10 modules" = the ten capability areas inside it.
- [x] Task 7.1: Shared KPI delta type (`lib/domain/delta.ts`) used by the Simulator cards, PDF report and decks
- [x] Task 7.2: Liquidity & covenant alerts from the three-statement model (base and downturn case), today vs scenario, on Red Team and Fork
- [x] Task 7.3: Shared PDF chrome: header, numbered footer, optional watermark (Confidential / Draft / Client copy) for both PDF generators
- [x] Task 7.4: IC deck (.pptx / PDF / Marp) from Simulator + Decision Room: scenario vs today, statements, Monte Carlo, liquidity, governance, stress, room gaps
- [x] Task 7.5: Presentation mode (`/present`): full-screen, client-safe, four simplified levers, live KPIs
- [x] Task 7.6: `WALKTHROUGH-SCRIPT.md` + Remotion project in `video/` (own package, Remotion 4.0.533; figures from the engines via `video/src/data.ts`; `pnpm video:render`, preview frames via `--still`). Excluded from root tsconfig/eslint.
  - [x] `/walkthrough` page (chapters, seek, follow-along) streaming from public Supabase Storage bucket `media` (created by `pnpm video:upload`; anonymous writes refused by RLS, range requests OK); landing-page link. Video files gitignored.
  - Open: voice-over audio, Remotion company-licence check


## Phase 8: Re-audit against the 10 reference patterns (2026-10-17)
All ten patterns were already integrated in Phases 5–6 (see substitutions there). Re-audit found:
- [x] Build-breaker: untracked reference clones (`anthropic-quickstarts/`, `claude-code/`, `obsidian-api/`) and installed skills (`.agents/`) were swept into `tsc`/ESLint, failing `type-check`, `lint` and `build`. Excluded in tsconfig/ESLint; clones gitignored.
- [x] Data desync: three-statement operating inputs lived in component state; Fork liquidity, Red Team liquidity and the IC deck silently used defaults, and edits were lost on navigation. Now `fork.statements` in the store, saved in the existing `fork` jsonb (no migration), read everywhere via `statementAssumptions()`.
- [x] Pattern 4 gap closed: firm invitations (migration `20261017120000_firm_invites.sql`, email-bound one-time links, `firm_roster()`), firm routes + `FIRM_POLICY`/`canChangeMember`, firm-level audit events, `/team` and `/join/[token]`, firm picker and grouping on `/companies`, safe `?next=` after sign-in. PGlite: 79 checks (email gate mutation-checked). Live RLS tests added.
  - Fixed on the way: a member deleting a colleague's company saw it silently reappear (RLS returns no rows, not an error); now explained.
  - Pushed `20261017090000_hardening` + `20261017120000_firm_invites` to `ahujzemhtytbiyuemuyy` (2026-10-17); live `pnpm test:rls` 16 passed, 4 API-route tests skipped (no dev server). Security advisor: trigger-function grants gone; remaining SECURITY DEFINER notices are the intended RPCs (each checks auth.uid()/membership); room_responses no-policy is intentional.
  - Open: invitation emails need SMTP (links are copied by hand for now).
  - [x] Supabase Auth URL configuration (Site URL + `https://www.bridgegen.io/**` redirects), verified by behaviour 2026-10-17: www paths honoured, foreign redirects and no-redirect links fall back to https://www.bridgegen.io.
- [x] Two-profile browser check (2026-10-17, Playwright, isolated contexts, live Supabase, throwaway users deleted): /team, /join (incl. forwarded/spent links), roles, shared companies, Decision Room presence, removal: 18/18. Fixed: joined firm now opens after accepting (`/team?firm=`), "You're a owner" copy, companies list rendered ungrouped before firms loaded.

## Phase 9: Production (2026-10-17)
- [x] Vercel project `bridge-gen` (team BridgeGen, Hobby) connected to `DeMolay5150/BridgeGen` `main`; duplicate `bridge-gen-7y4q` removed
- [x] Production env: Supabase URL, publishable key, secret key (sensitive), `NEXT_PUBLIC_SITE_URL=https://www.bridgegen.io`
- [x] Custom domain: `www.bridgegen.io` (CNAME at Porkbun → Vercel), `bridgegen.io` 308 → www
- [x] Security headers on every response (`next.config.ts`): frame-ancestors/X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, base-uri, object-src; X-Powered-By off; HSTS from Vercel
- [x] Final verification on https://www.bridgegen.io at `8e93f45`: all routes 200, API refuses outsiders, `pnpm test:rls` with API routes 20/20, `pnpm test:e2e` 18/18, walkthrough streams from Storage
- Not covered: a real confirmation email end to end (needs SMTP + an inbox)

## Open items before launch (roadmap closed 2026-10-17)
Phases 1–9 are done and live on https://www.bridgegen.io. What remains needs an outside service, a plan upgrade or a decision; none of it blocks the demo.

### Supabase support case: Realtime "Allow public access" not enforced
- Project `ahujzemhtytbiyuemuyy` (org on Free). "Allow public access" shows **off** under Project Settings → Realtime, and stays off after a reload (2026-10-17).
- Expected: a public (non-private) channel join is rejected with Realtime error `PrivateOnly` ("The connection was rejected because this project only allows private channels").
- Actual: an anonymous client (publishable key, no session) gets `SUBSCRIBED` on a public channel, and a broadcast between two such clients is delivered (open relay). Re-probed 11+ times over two sessions.
- Logs: the Realtime tenant was terminated at 2026-10-18 04:19:19 UTC (no connected users) and re-initialised at 06:24:31 UTC; the probe two seconds later still joined the public channel, and no `PrivateOnly` rejection was logged. So it is not a stale cache.
- Unaffected: private `company:<id>` channels refuse anonymous joins ("Unauthorized: You do not have permissions to read from this Channel topic"), enforced by RLS on `realtime.messages`. No company data is exposed; the risk is quota abuse.
- Re-check after Supabase responds: `node realtime-relay-probe.mjs` (session scratchpad) should print `BLOCKED` / `CHANNEL_ERROR: PrivateOnly` for the public channel, and still `Unauthorized` for the private one.

### Needs an external service or plan
- [ ] Custom SMTP; then turn "Confirm email" back on and send invitation emails (links are copied by hand today); verify a real confirmation email end to end
- [ ] Leaked-password protection (HaveIBeenPwned): needs the Supabase Pro plan
- [ ] Billing and plan limits (Stripe), real trial mechanics, `NEXT_PUBLIC_SALES_CONTACT_URL` for sales CTAs

### Needs a decision
- [ ] Walkthrough voice-over audio
- [ ] Remotion company licence (required for organisations over three people)
