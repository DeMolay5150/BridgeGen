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

## Phase 3: Governance & Stress-Testing
- [x] Task 3.1: Build multi-stakeholder "Decision Room" (Founder vs Heir vs Board views)
  - Route `/room`: tabs for Founder, Next-gen heir, Board, Lender + Facilitator (inactive tabs unmount)
  - Each view: support score + drivers, role KPIs, 7 priority sliders that replace matrix weights app-wide
  - Private 6-topic questionnaire: own position + prediction of another stakeholder; "Submit & hide"
  - `detectGaps` (`lib/room/gaps.ts`): disagreements (spread ≥2) and misperceptions (|prediction − actual| ≥2), never exposing raw answers
  - In-memory only; true per-person confidentiality awaits Supabase auth + RLS
  - 20 new Vitest tests (gaps, priorities, room store)
- [ ] Task 3.2: Implement "Red Team Mode" emergency stress-testing scenarios
- [ ] Task 3.3: Implement "Explain This Decision" glass-box logic cards
