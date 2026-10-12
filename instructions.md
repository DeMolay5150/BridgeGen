# Technical Stack & Design System Guardrails

## Technology Stack
- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (Strict Mode)
- **Styling & UI:** Tailwind CSS v4 (CSS-first config in `app/globals.css`, no `tailwind.config`), shadcn/ui components, Lucide icons
- **Package Manager:** pnpm (pinned via `packageManager` in package.json)
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

## Theme Implementation (`app/globals.css`)
- **Dark-only:** tokens are defined once on `:root`; `<html>` carries the `dark` class so shadcn `dark:` variants always apply. No light theme.
- **shadcn/ui:** `base-nova` style on Base UI primitives (`@base-ui/react`), configured in `components.json`. Add components with `pnpm dlx shadcn@latest add <name>`. Class merging uses the `cn` package (re-exported from `@/lib/utils`).
- **Prefer semantic tokens over raw palette classes:**
  - Surfaces: `bg-background` (slate-950), `bg-card` (slate-900), `border-border` (slate-800/80), `text-muted-foreground` (slate-400)
  - Signals: `text-positive` / `bg-positive/10` (emerald), `text-caution` / `bg-caution/10` (amber), `text-metric` / `bg-metric/10` (cyan), `text-critical` / `bg-critical/10` (rose)
  - Charts: `chart-1`…`chart-5` map to metric, positive, caution, critical, slate-400
- **Charts:** Recharts 3 via shadcn's `ChartContainer` (`components/ui/chart.tsx`). Give the container an explicit height (e.g. `aspect-auto h-80`); colour marks with the CSS variables (`var(--metric)`, `var(--chart-5)`).
- **Routes & navigation:** `/` (landing), `/simulator` (Flight Simulator + Economics vs. Alignment), `/governance` (Governance Debt), `/fork` (Fork the Future). Shared slider UI lives in `components/slider-row.tsx`. Add new modules to `LINKS` in `components/site-nav.tsx`. All modules share one Zustand store (`lib/simulator/store.ts`), held in memory only until Supabase lands.
- **Fonts:** Geist Sans (`font-sans`, `font-heading`) and Geist Mono (`font-mono`, use for figures and labels).
