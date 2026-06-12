import tsParser from '@typescript-eslint/parser'
import betterTailwind from 'eslint-plugin-better-tailwindcss'

/**
 * Flat ESLint config scoped to Tailwind class linting.
 *
 * This brings the "Tailwind IntelliSense" diagnostics (e.g. suggesting the
 * canonical `scheme-dark` instead of the arbitrary `[color-scheme:dark]`) to
 * the command line so they are caught by the `check`/`lint` scripts in CI,
 * not just inside the editor.
 *
 * Only correctness + canonicalisation rules are enabled. The purely cosmetic
 * rules (class ordering, line wrapping, whitespace) are intentionally left off
 * so linting never reformats existing markup.
 */
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'better-tailwindcss': betterTailwind,
    },
    settings: {
      'better-tailwindcss': {
        // Tailwind v4 resolves its theme from the CSS entry point.
        entryPoint: 'src/index.css',
      },
    },
    rules: {
      // Rewrite arbitrary utilities to their canonical form
      // (e.g. `[color-scheme:dark]` -> `scheme-dark`).
      'better-tailwindcss/enforce-canonical-classes': 'warn',
      // Collapse pairs like `w-4 h-4` into `size-4`.
      'better-tailwindcss/enforce-shorthand-classes': 'warn',
      // Flag classes that fight each other or no longer exist.
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'warn',
    },
  },
]
