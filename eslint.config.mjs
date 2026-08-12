import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: 'project/strict',
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React
      'react/no-array-index-key': 'error',
      'react/jsx-no-useless-fragment': 'error',
      'react/display-name': 'warn',

      // General
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    // Standalone CLI tooling may print to stdout/stderr like any script
    // (historical-data importer + `prisma db seed`).
    name: 'project/scripts',
    files: ['scripts/**/*.ts', 'prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'dist/**',
  ]),
]);

export default eslintConfig;
