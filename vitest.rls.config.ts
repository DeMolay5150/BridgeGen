import { defineConfig } from "vitest/config";

/** Row-level security checks against the real Supabase project in .env.local. */
export default defineConfig({
  test: {
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // One project, shared users: run serially.
    fileParallelism: false,
  },
});
