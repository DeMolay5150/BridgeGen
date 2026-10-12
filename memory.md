# Active Session Memory & QA Log

## Current Execution State
- Workspace setup: COMPLETE
- Next.js 16 environment: COMPLETE (Task 1.1)
- Core Simulation Engine: IN PROGRESS (Task 2.1 Flight Simulator complete)

## Active Build Notes
- System framework initialized under multi-agent file architecture with Staff Engineer workflow rules, Red Team protocols, and GitHub integration.
- 2026-10-12: Stack moved from Next.js 14 to 16 (14.x is EOL with unpatched critical CVEs, incl. Windows RCE GHSA-p293-qw3h-jr36). Brings React 19, Tailwind v4, ESLint 9 flat config.
- Next 16 enables `cacheComponents` and `partialPrefetching` in next.config.ts by default — read `node_modules/next/dist/docs/` before using data-fetching/caching APIs.
- Dev machine quirks: `pnpm` is not on PATH (corepack enable fails), so use `corepack pnpm ...`. Windows Controlled Folder Access is on; git run from the sandboxed bash tool failed to write `.git`, so run git via PowerShell.
- 2026-10-12: shadcn/ui 4.21.4 initialized (Task 1.3) with `base-nova` (Base UI). The `cn` dependency is shadcn's official clsx+tailwind-merge replacement, not a typo. The `shadcn` package lives in devDependencies (only its `tailwind.css` is imported, at build time); as a prod dep it pulled a high-severity `braces` advisory into `pnpm audit --prod`.
- shadcn CLI shells out to `pnpm`; since pnpm isn't on PATH, prepend a dir containing a `pnpm.cmd` shim (`@corepack pnpm %*`) before running `pnpm dlx shadcn ...`.
- PowerShell 5.1 mangles `git commit -m` here-strings containing double quotes; write the message to a file and use `git commit -F`.
- 2026-10-12: Flight Simulator (Task 2.1). Model conventions for later tasks: currency in USD millions, rates as fractions. Leverage is debt / *baseline* EBITDA; changing it moves value between equity and cash (netDistribution = total − existing debt: +recap payout, −capital required), so equity + distribution is constant. Risk thresholds (coverage 2x/3x, leverage 4x/5x) live in `lib/simulator/engine.ts`. Store re-anchors the leverage slider when baseline EBITDA or debt is edited.
- Base UI slider wrapper (`components/ui/slider.tsx`) renders two thumbs unless `value` is an array: always pass `value={[n]}`. Label sliders with `aria-labelledby` on the root. Link buttons: `<Button nativeButton={false} render={<Link href=… />}>`.
- After `pnpm add`/`remove`, restart `pnpm dev`: the pnpm store path hash for `next` changes and a long-running dev server throws "Could not find the module … in the React Client Manifest".
- `unrs-resolver` postinstall is intentionally not approved (pnpm 10 blocks build scripts); its prebuilt binaries ship via optional deps.
