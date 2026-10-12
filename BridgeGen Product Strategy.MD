Please initialize our root project file structure. Create the following 7 files inside this repository with their respective contents:

--- FILE: CLAUDE.md ---
# BridgeGen — Master Agent Configuration

<prompt>
<role>
You are an elite AI systems architect, agentic-workflow strategist, and Lead Engineer for BridgeGen (The Next-Gen Legacy & Governance Simulator).
You specialize in building high-performance multi-agent workflows, prompt engineering, tool use, memory management, and quality control.
When performing code reviews, you also act as a ruthless Red Team auditor, stress-testing our architecture for bugs, edge cases, and performance bottlenecks.
</role>

<objective>
Build and maintain BridgeGen using a lean, reliable multi-agent system with clear roles, explicit handoffs, strict state management, GitHub version control, and human-in-the-loop validation checkpoints.
</objective>

<context>
- Primary Agent CLI / Orchestrator: Claude Code / OmniRoute
- Workspace State Framework: CLAUDE.md, goal.md, instructions.md, output.md, memory.md, review.md, tasks/todo.md, tasks/lessons.md
- Tech Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), Vercel
- MCP Tools: Filesystem, GitHub, Playwright, Graphify, Firecrawl
</context>

<workflow_orchestration>
### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, STOP and re-plan immediately — don't keep pushing blindly.
- Write detailed specs upfront in tasks/todo.md to reduce ambiguity.

### 2. Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- Execute one focused task per subagent.

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern.
- Write rules for yourself to prevent repeating the same mistake.
- Review lessons at session start for relevant project context.

### 4. Verification Before Done
- Never mark a task complete without proving it works.
- Ask yourself: "Would a Staff Engineer approve this?"
- Run typechecks, tests, check logs, and demonstrate correctness.

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "Is there a more elegant way?"
- If a fix feels hacky: ask "Knowing everything I know now, implement the elegant solution."
- Skip over-engineering on simple, obvious fixes.

### 6. Autonomous Bug Fixing
- When given a bug report: resolve it autonomously using logs and failing test outputs.
- Require zero context switching or manual hand-holding from the user.
</workflow_orchestration>

<red_team_protocol>
When evaluating any proposed code, UI layout, or backend architecture:
- ATTACK: Identify how the UI could break, where performance lags, or where data desyncs.
- EXPOSE: Rank the top potential failure points in the code.
- DEFEND: Apply robust TypeScript types, error boundaries, and defensive checks to fix each flaw.
- STRIKE: Verify the clean code compiles with zero errors or warnings before marking complete.
</red_team_protocol>

<core_principles>
- Simplicity First: Make every change as simple as possible. Touch minimal code.
- No Laziness: Find root causes. No temporary fixes or hacky workarounds. Senior developer standards.
- Minimal Impact: Changes should only touch what's necessary. Avoid introducing regressions.
</core_principles>

<final_checks>
Before declaring any task complete, ask yourself:
- Is every component and type definition strictly necessary?
- Are data handoffs between Supabase, Next.js, and client state clean?
- Has the code survived a Red Team stress test for edge cases?
- Are changes committed to the Git repository with a clear message?
- Does this code adhere to our "Quiet Luxury" design system?
</final_checks>
</prompt>

## Core Project Imports
@./goal.md
@./instructions.md

## Development Commands
- Dev Server: `pnpm dev`
- Type Check: `pnpm type-check`
- Linting: `pnpm lint`
- Git Commit: `git add . && git commit -m "feat: [description]"`

--- FILE: goal.md ---
# BridgeGen — Product Vision & Strategy

## Primary Positioning
- **Brand Name:** BridgeGen
- **Tagline / Value Proposition:** Private Company Decision Simulator — *"See the systemic consequences before you make the decision."*
- **Primary ICP:** Multi-Family Offices ($100M–$1B+ AUM), Private Banks, CPAs, M&A Advisors, and Estate Attorneys.
- **Go-To-Market Architecture:** Trojan Horse Model (Interactive Decision Simulator for front-end sales/demos backed by a recurring Succession Readiness & Governance Operating System as system of record).

## Core Feature Suite
1. **Capital Allocation Flight Simulator:** Interactive sliders for debt leverage, equity transfer, valuation sensitivity, and outside CEO scenarios.
2. **Decision Room & Stakeholder POVs:** Distinct simulation views for Founders, Next-Gen Heirs, Board Members, and Lenders with confidential perception gap detection.
3. **Economics vs. Alignment Dual-Matrix:** Displays financial performance alongside stakeholder consensus score.
4. **Governance Debt Calculator:** Quantifies undocumented authority, missing board seats, and informal voting rules into a monetary risk score ($Risk / 100).
5. **"Fork the Future" Timelines:** Side-by-side branch comparison across 1, 3, 5, and 10-year horizons.
6. **Red Team Mode (Stress-Testing Engine):** Automated adversarial simulation for founder incapacitation, successor exit, or economic downturns.
7. **Glass-Box Logic ("Explain This Decision"):** Plain-language breakdown of cascading consequences behind every simulated outcome.

--- FILE: instructions.md ---
# Technical Stack & Design System Guardrails

## Technology Stack
- **Framework:** Next.js 14 (App Router), React, TypeScript (Strict Mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui components, Lucide icons
- **State Management & Visualization:** Zustand, Recharts / Tremor for dynamic scenario graphics
- **Database & Auth:** Supabase (PostgreSQL with Row-Level Security)
- **Deployment & Infra:** Vercel (Connected via GitHub)

## UI/UX Design System ("Quiet Luxury Tech")
- **Background Palette:** Dark Slate base (`bg-slate-950`, `bg-slate-900`)
- **Borders & Dividers:** Subtle, high-precision dark borders (`border-slate-800/80`)
- **Typography:** High-contrast white/slate text using crisp sans-serif fonts (Inter or Geist)
- **Accent Indicators (Restrained Use):**
  - Emerald (`text-emerald-400` / `bg-emerald-500/10`): Growth, positive alignment, low risk
  - Amber (`text-amber-400` / `bg-amber-500/10`): Caution, perception gap, governance debt
  - Cyan (`text-cyan-400` / `bg-cyan-500/10`): Metrics, financial figures, data indicators
  - Rose (`text-rose-400` / `bg-rose-500/10`): Critical risk, red team failure points

--- FILE: output.md ---
# Build Manifest & Output Buffer

This file stores generated components, SQL schemas, API routes, and architectural blueprints before final integration.

Status: Waiting for initial build tasks.

--- FILE: memory.md ---
# Active Session Memory & QA Log

## Current Execution State
- Workspace setup: INITIALIZING
- Next.js 14 environment: PENDING
- Core Simulation Engine: PENDING

## Active Build Notes
- System framework initialized under multi-agent file architecture with Staff Engineer workflow rules, Red Team protocols, and GitHub integration.

--- FILE: review.md ---
# Build Review Status

STATUS: PENDING

## Verification Checklist
- [ ] Next.js 14 boilerplate initialized
- [ ] Tailwind CSS dark mode configuration applied
- [ ] Root 5-file state system connected
- [ ] TypeScript strict mode verified
- [ ] GitHub repository linked & initial commit made
- [ ] Staff Engineer workflow protocols active

--- FILE: tasks/todo.md ---
# BridgeGen Implementation Roadmap

## Phase 1: Environment & Workspace Setup
- [ ] Task 1.1: Initialize Next.js 14 app with TypeScript, Tailwind CSS, and App Router
- [ ] Task 1.2: Configure `CLAUDE.md`, state file connectors, and Git repository
- [ ] Task 1.3: Set up shadcn/ui component library with "Quiet Luxury" dark theme

## Phase 2: Decision Laboratory Engine
- [ ] Task 2.1: Build Capital Allocation Flight Simulator with interactive sliders
- [ ] Task 2.2: Implement "Economics vs. Alignment" dual-matrix chart
- [ ] Task 2.3: Build "Governance Debt" calculation module
- [ ] Task 2.4: Implement "Fork the Future" side-by-side branch comparison

## Phase 3: Governance & Stress-Testing
- [ ] Task 3.1: Build multi-stakeholder "Decision Room" (Founder vs Heir vs Board views)
- [ ] Task 3.2: Implement "Red Team Mode" emergency stress-testing scenarios
- [ ] Task 3.3: Implement "Explain This Decision" glass-box logic cards

--- FILE: tasks/lessons.md ---
# Self-Improvement & Error Log

This file tracks technical mistakes, failed builds, and architectural corrections to avoid repeating them in future turns.

## Lessons Learned
- Ensure all Supabase Row-Level Security (RLS) policies are explicitly tested per stakeholder role.
- Keep UI layout responsive using standard Tailwind breakpoints (`md:`, `lg:`).
- Always commit code to GitHub upon completing milestone tasks.
- Always execute <final_checks> and <workflow_orchestration> rules before marking a build step complete in review.md.