# Self-Improvement & Error Log

This file tracks technical mistakes, failed builds, and architectural corrections to avoid repeating them in future turns.

## Lessons Learned
- Ensure all Supabase Row-Level Security (RLS) policies are explicitly tested per stakeholder role.
- Keep UI layout responsive using standard Tailwind breakpoints (`md:`, `lg:`).
- Always commit code to GitHub upon completing milestone tasks.
- Always execute <final_checks> and <workflow_orchestration> rules before marking a build step complete in review.md.
- RLS helper functions marked `STABLE` read the statement's starting snapshot: rows a trigger inserts mid-statement (e.g. an on-demand firm membership) are invisible to that statement's policy check. Create prerequisites in an earlier statement (e.g. on sign-up).
- Verify migrations without Docker by running them in PGlite (Postgres WASM) with stubbed `auth.users` / `auth.uid()` and the `anon`/`authenticated` roles; it caught a first-insert RLS failure the code review missed.
- react-pdf: a `render` (page-number) Text that inherits a page-level `lineHeight` renders nothing, and the `fixed` footer silently disappears. Never set `lineHeight` on `Page` or wrapper Views; set it on text styles. The PDF test asserts every page's footer.
- Dev-server browser checks: use `localhost`, not `127.0.0.1` (Next blocks HMR for unlisted origins and the page reload-loops). First compile can take 75s+ on this drive.
- Base UI Tabs/Dialog only unmount a closed panel when its exit transition completes (animation frames), which never happens in a background tab. Where unmounting is a guarantee (Decision Room confidentiality), render panel content conditionally on the controlled value.
- PDF/static lists: never key rows by display text; it can repeat ("Equity is wiped out" appears twice in breaking points). Use positional keys for static documents.
- Cache Components prerenders client components: no `Date.now()`/`Math.random()` in render or `useState` initialisers.
- Browser checks with Playwright against `next dev`: navigate with `waitUntil: "domcontentloaded"` (the `load` event may never fire), read `main:visible` (Next 16 keeps the previous route mounted but hidden after client navigation, so there are two `<main>`s), and match headings by role/name, not `innerText` (it applies CSS `uppercase`). Sign test users in via the admin API + @supabase/ssr cookies, one isolated context per user, and delete them in `finally`.
- Pages that render data from two queries (e.g. companies + firms) should wait for both before rendering, or the list renders in one shape and jumps to another; caught by the two-profile browser check, not by unit tests.
