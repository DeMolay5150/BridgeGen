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
- [ ] Task 2.3: Build "Governance Debt" calculation module
- [ ] Task 2.4: Implement "Fork the Future" side-by-side branch comparison

## Phase 3: Governance & Stress-Testing
- [ ] Task 3.1: Build multi-stakeholder "Decision Room" (Founder vs Heir vs Board views)
- [ ] Task 3.2: Implement "Red Team Mode" emergency stress-testing scenarios
- [ ] Task 3.3: Implement "Explain This Decision" glass-box logic cards
