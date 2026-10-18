# Technical Stack & Design System Guardrails

## Technology Stack
- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (Strict Mode)
- **Styling & UI:** Tailwind CSS v4 (CSS-first config in `app/globals.css`, no `tailwind.config`), shadcn/ui components, Lucide icons
- **Package Manager:** pnpm (pinned via `packageManager` in package.json)
- **State Management & Visualization:** Zustand, Recharts / Tremor for dynamic scenario graphics
- **Database & Auth:** Supabase (PostgreSQL with Row-Level Security)
- **Deployment & Infra:** Vercel (Connected via GitHub)

## Supabase (persistence & auth)
- **Setup:** copy `.env.example` → `.env.local` (URL, publishable key, secret key). Without it the app runs as the in-memory public demo; nothing breaks.
- **Clients:** `lib/supabase/client.ts` (browser), `server.ts` (cookies, RLS as the user), `admin.ts` (secret key, `server-only`, room routes only, after authorization). `proxy.ts` refreshes sessions (Next 16's renamed middleware).
- **Schema:** `supabase/migrations/`. Multi-seat firms (`20261014090000_firms.sql`): every advisor gets a personal firm at sign-up; `companies` (and their `room_invites`) are visible to members of the company's `firm_id` via RLS (`is_firm_member` / `firm_role` helpers). Roles: owner > admin > member; only creators, owners and admins delete companies; a firm always keeps one owner; firms are created via `create_firm()`. Colleagues join only by accepting an invitation (`20261017120000_firm_invites.sql`): a one-time `/join/[token]` link (SHA-256 hash stored) that `accept_firm_invite()` honours only for the invited, confirmed email; invitations grant admin or member, never owner. Emails come from `firm_roster()` (members only). Firm routes live in `app/api/firms/` and `app/api/firm-invites/`, authorized by `FIRM_POLICY` / `canChangeMember()` in `lib/authz/policy.ts` and audited with `recordAudit({ firmId })`. `room_responses` has RLS on with no policies and revoked privileges, so only the server reads it, for every role. Every new table needs RLS + a check in `tests/rls/`. Membership helpers are `STABLE`: never create a membership in the same statement whose RLS check depends on it.
- **Permissions & audit:** room routes call `authorize(id, action)` (`lib/room/server.ts`), which applies the Cerbos-style table in `lib/authz/policy.ts` on top of RLS (default deny; keep it in step with the RLS policies). Server-side events go through `recordAudit()` (`lib/audit/server.ts`) into append-only `audit_events` (owners/admins read; metadata never holds answers). Run `pnpm test:migrations` (PGlite, no Docker) before any `db push`.
- **Live rooms:** `lib/realtime/live-room.ts` joins the private channel `company:<id>` (presence, cursors, last-write-wins sync of baseline/scenario/governance/priorities; never room answers). RLS on `realtime.messages` admits firm members only (`20261016090000_realtime_rooms.sql`); in the Supabase dashboard, turn off Realtime "Allow public access". Every inbound payload is parsed with the persistence schemas (`lib/realtime/protocol.ts`).
- **Confidentiality rule:** raw Decision Room answers never leave the server. Advisors get `detectGaps()` output only; stakeholders reach their own answers only via their invite token (stored as a SHA-256 hash).
- **Persistence:** `lib/persistence/serialize.ts` validates and default-merges saved rows; `components/session-sync.tsx` autosaves the open company.

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
- **Routes & navigation:** `/` (landing), `/simulator` (Flight Simulator + Economics vs. Alignment), `/governance` (Governance Debt), `/fork` (Fork the Future), `/room` (Decision Room), `/red-team` (Red Team Mode), `/pricing` (plans; prices only in `lib/pricing/plans.ts`, kept in step with `PRICING.md`), `/login` (accepts a safe `?next=`), `/companies`, `/team` (firm members, roles, invitations), `/join/[token]` (firm invitation links), `/respond/[token]` (stakeholder invite links), `/walkthrough` (product video from the public Supabase Storage bucket `media`, local `public/` fallback; chapters in `lib/walkthrough.ts`). Shared controls: `components/slider-row.tsx`, `components/segmented.tsx`. Nav links may define a `short` label for phones. Add new modules to `LINKS` in `components/site-nav.tsx`. All modules share one Zustand store (`lib/simulator/store.ts`), held in memory only until Supabase lands.
- **Glass-box rule:** every new headline outcome gets a deterministic explainer in `lib/explain/` (steps built from engine outputs, never recomputed differently) and an `ExplainButton` (`components/explain/explain-button.tsx`) next to it. No AI-generated numbers.
- **Fonts:** Geist Sans (`font-sans`, `font-heading`) and Geist Mono (`font-mono`, use for figures and labels).
