import { defineConfig, devices } from '@playwright/test';

// Distinct port so E2E never collides with a running `pnpm dev` on 3000.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Run against `next start` (production build) — `next dev` compiles on demand
  // and blows past test timeouts. Build first with `pnpm build`.
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    // Never reuse a server on the port: a stale/broken `next start` was once
    // silently reused and hung a request. Error loudly instead.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
