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
  - Open before launch: turn "Confirm email" back on with custom SMTP; set `NEXT_PUBLIC_SITE_URL`
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
- [ ] Task 5.3: Tremor-style KPI cards: delta-vs-Today badges in the simulator; sparkline + delta on Fork branch cards
- [ ] Task 5.4: shadcn Dialog + "Export executive summary" dialog in the Decision Room
- [ ] Task 5.5: `@react-pdf/renderer` multi-page branded PDF (cover/BLUF, capital allocation, governance, red team, room gaps; never raw answers); lazy-loaded
- [ ] Task 5.6: Route hardening: JSON-only + same-origin checks on mutating routes, tested
- [ ] Task 5.7: Multi-seat firms migration (firms, firm_members, companies.firm_id, membership RLS) + RLS tests. Written, NOT pushed to the live project without sign-off
