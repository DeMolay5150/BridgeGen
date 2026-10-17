import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party reference clones kept locally (gitignored), not part of the app.
    "anthropic-quickstarts/**",
    "claude-code/**",
    "obsidian-api/**",
    // Installed agent skills (vendored scripts and bundles).
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
