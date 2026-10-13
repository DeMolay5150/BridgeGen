import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    // Live-database checks run separately via `pnpm test:rls`.
    exclude: ["tests/**", "node_modules/**"],
  },
});
