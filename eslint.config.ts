import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginSecurity from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  // Never lint build output, coverage, generated registry, or vendored deps.
  // `**/` prefixes catch nested build dirs (e.g. fixtures/*/dist, .astro).
  globalIgnores([
    "**/dist/**",
    "**/coverage/**",
    "**/.astro/**",
    "**/pagefind/**",
    "registry/r/**",
    ".npm/**",
    ".npm-cache/**",
  ]),

  // Base JS recommended rules for all source files.
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // TypeScript recommended (syntactic; no type information required).
  tseslint.configs.recommended,

  // Security scanning (mirrors Codacy's ESLint security patterns).
  pluginSecurity.configs.recommended,

  // React rules, scoped to files that actually contain JSX.
  {
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
    plugins: {
      ...pluginReact.configs.flat.recommended.plugins,
      "react-hooks": pluginReactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      // New JSX transform (react-jsx) — no React import required in scope.
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },

  // Type-aware correctness rules — the ones Codacy's default standard flags
  // that are worth enforcing. Scoped to `src/**` because those files are
  // covered by tsconfig.json's `include`, which the type-aware parser needs.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/restrict-template-expressions": "error",
      "@typescript-eslint/no-base-to-string": "error",
    },
  },

  // Tests build regexes from strings and use literal test patterns; the
  // security regexp heuristics are noise there (and Codacy excludes tests).
  {
    files: ["tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
    },
  },

  // Governed exceptions — cosmetic or false-positive-prone rules we
  // deliberately silence repo-wide (see CONTRIBUTING / commit rationale):
  //   - no-confusing-void-expression: fights idiomatic React event handlers
  //     like `onClick={() => setOpen(true)}`.
  //   - no-unnecessary-condition: fires on defensive runtime guards that TS
  //     considers redundant only because `noUncheckedIndexedAccess` is off
  //     (e.g. `record[key] ?? fallback`) and on TanStack Query's narrowed
  //     `isLoading`/`isError` types. Removing the guards would be a real bug.
  //   - security/detect-object-injection: false positives on typed
  //     `dict[key]` lookups where the key is a known string-union.
  //   - security/detect-non-literal-fs-filename: false positives in trusted
  //     dev-only build scripts (no untrusted input).
  {
    rules: {
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
]);
