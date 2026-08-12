import { expect, test } from '@playwright/test';

/**
 * Security-focused E2E tests. Exercises the proxy (rate limiting, CSP)
 * against the running production build (`next start`).
 *
 * These tests make **real** server requests — they do NOT mock `/api/**`
 * — so the proxy's rate limiter and CSP headers are applied.
 */

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

test.describe('Security headers', () => {
  test('HTML responses carry CSP with a nonce plus static security headers', async ({
    request,
  }) => {
    const res = await request.get('/dashboard');
    const headers = res.headers();

    // CSP must include a per-request nonce for inline scripts.
    expect(headers['content-security-policy']).toContain("script-src 'self' 'nonce-");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");

    // Static headers set in next.config.ts.
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

// Matches RATE_LIMIT_SCREEN_MAX set on the webServer in playwright.config.ts.
const SCREEN_RATE_LIMIT = 5;

test.describe('Rate limiting', () => {
  test(`returns 429 after exceeding the /api/screen limit (${SCREEN_RATE_LIMIT} req)`, async ({
    request,
  }) => {
    // Send enough requests to exceed the default screen limit. The screen
    // endpoint will 500 on a missing DB, but the proxy answers 429 *before*
    // the route handler runs, so no database is needed.
    let got429 = false;

    for (let i = 0; i < SCREEN_RATE_LIMIT + 5; i++) {
      const res = await request.get('/api/screen');
      if (res.status() === 429) {
        got429 = true;
        expect(res.status()).toBe(429);
        const body = await res.json();
        expect(body).toHaveProperty('error');
        expect(res.headers()['retry-after']).toBeDefined();
        break;
      }
    }

    expect(got429).toBe(true);
  });
});
