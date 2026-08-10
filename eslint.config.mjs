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
    // Local git worktree scratch space (superpowers plan-driven-development) —
    // gitignored, has its own next-env.d.ts/build artifacts, shouldn't be linted.
    ".worktrees/**",
    // Separate standalone Node microservice (Baileys WA), not part of the
    // Next.js app — not written against React/Next lint rules.
    "baileys-service/**",
  ]),
]);

export default eslintConfig;
