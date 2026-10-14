import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    // Live-database checks run separately via `pnpm test:rls`.
    exclude: ["tests/**", "node_modules/**"],
  },
});
