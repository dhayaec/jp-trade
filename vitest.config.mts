import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Next aliases `server-only` internally at build; give vitest a local empty module.
      'server-only': fileURLToPath(new URL('./tests/mocks/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Core logic only: services, validation schemas, and server utilities.
      // UI components are exercised via Playwright E2E instead.
      include: [
        'src/server/**/*.ts',
        'src/features/**/services/**/*.{ts,tsx}',
        'src/features/**/validations.ts',
      ],
      exclude: ['src/**/*.d.ts', '**/*.test.{ts,tsx}'],
    },
  },
});
