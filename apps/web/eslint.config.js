import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Existing code predates these React Compiler rules (dialogs reset form
      // state in an effect on open). Surface them without failing CI.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-refresh/only-export-components": "warn",
    },
  },
  // shadcn/ui files export variant helpers next to components by design.
  {
    files: ["src/components/ui/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
)
