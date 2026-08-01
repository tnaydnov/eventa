import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * Flat ESLint config (ESLint 9 + eslint-config-next 16).
 *
 * The rule severities below are deliberate, not accidental. Rules demoted to
 * `warn` flag pre-existing patterns that are stylistic or would need a large
 * mechanical refactor; they stay visible as a cleanup backlog instead of being
 * silenced. Rules that catch real correctness or security problems remain
 * errors and gate CI.
 */

/** Plugins registered by eslint-config-next, reused so overrides resolve. */
const nextPlugins = coreWebVitals[0].plugins;

export default [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/sw.js',
      'next-env.d.ts',
    ],
  },

  ...coreWebVitals,
  ...typescript,

  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: nextPlugins,
    rules: {
      // Cleanup backlog - visible, but not release-blocking.
      '@next/next/no-html-link-for-pages': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Underscore prefix is the project opt-out for intentionally unused bindings.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // Build/ops scripts are CommonJS Node programs, not bundled app code.
    files: ['scripts/**/*.cjs', '*.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // Tests deliberately use `require()` for mid-test module re-imports (to pick
    // up mutated env vars) and loose `Function` types for mock signatures.
    files: ['__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  },
];
