import js from "@eslint/js";
import eslintReact from "@eslint-react/eslint-plugin";
import tseslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import pluginSecurity from "eslint-plugin-security";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.astro/**",
      "**/.cache/**",
      "**/.vite/**",
      "**/node_modules/**",
      "**/pagefind/**",
      "registry/r/**",
      "fixtures/**",
      ".npm/**",
      ".npm-cache/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs["flat/recommended"],
  pluginSecurity.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    ...eslintReact.configs["recommended-typescript"],
  },
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
  {
    files: ["tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "security/detect-non-literal-regexp": "off",
      "security/detect-unsafe-regex": "off",
    },
  },
  {
    rules: {
      // The package supports React 18 as well as React 19, so it cannot require
      // React 19-only provider and `use()` conventions. Its state-sync effects
      // intentionally mirror asynchronous prompt/auth inputs into local UI state.
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-use-context": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
