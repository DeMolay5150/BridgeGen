# Active Session Memory & QA Log

## Current Execution State
- Workspace setup: COMPLETE
- Next.js 16 environment: COMPLETE (Task 1.1)
- Core Simulation Engine: PENDING

## Active Build Notes
- System framework initialized under multi-agent file architecture with Staff Engineer workflow rules, Red Team protocols, and GitHub integration.
- 2026-10-12: Stack moved from Next.js 14 to 16 (14.x is EOL with unpatched critical CVEs, incl. Windows RCE GHSA-p293-qw3h-jr36). Brings React 19, Tailwind v4, ESLint 9 flat config.
- Next 16 enables `cacheComponents` and `partialPrefetching` in next.config.ts by default — read `node_modules/next/dist/docs/` before using data-fetching/caching APIs.
- Dev machine quirks: `pnpm` is not on PATH (corepack enable fails), so use `corepack pnpm ...`. Windows Controlled Folder Access is on; git run from the sandboxed bash tool failed to write `.git`, so run git via PowerShell.
- `unrs-resolver` postinstall is intentionally not approved (pnpm 10 blocks build scripts); its prebuilt binaries ship via optional deps.
