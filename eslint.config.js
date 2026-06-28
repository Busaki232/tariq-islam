import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-ssr",
      "node_modules",
      ".vercel",
      "android/**/build/**",
      "android/.gradle/**",
      "supabase/.branches/**",
      "supabase/.temp/**",
      "supabase/.cache/**",
    ],
  },

  // Base TS/TSX linting
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Your project choices
      "@typescript-eslint/no-unused-vars": "off",

      // Stop build-breaking lint errors you listed
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-empty": "off",

      // Keep these as warnings, not blockers
      "react-hooks/exhaustive-deps": "warn",
      "prefer-const": "warn",
      "no-case-declarations": "warn",
    },
  },

  // Node config files like tailwind.config.ts can legitimately use require()
  {
    files: ["**/tailwind.config.{ts,js,cjs,mjs}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Supabase Edge Functions often behave like Deno/Node server code
  {
    files: ["supabase/functions/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "no-case-declarations": "off",
      "prefer-const": "off",
    },
  },
);
