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
