import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Fixture payloads returned by the mocked API endpoints.
// ---------------------------------------------------------------------------

const MOCK_SCREEN = [
  {
    symbol: 'RELIANCE',
    score: 78,
    volumeRatio: 2.1,
    rsi: 58,
    patternCount: 2,
    isORB: true,
    patterns: ['TSUTSUMI', 'MARUBOZU'],
    lastClose: 3450.25,
  },
  {
    symbol: 'TCS',
    score: 62,
    volumeRatio: 1.3,
    rsi: 52,
    patternCount: 1,
    isORB: false,
    patterns: ['SANBASU'],
    lastClose: 3120.5,
  },
];

const MOCK_CANDLES = [
  { timestamp: 1720000000000, open: 100, high: 105, low: 99, close: 104, volume: 500_000 },
  { timestamp: 1720086400000, open: 104, high: 108, low: 103, close: 107, volume: 600_000 },
  { timestamp: 1720172800000, open: 107, high: 110, low: 106, close: 109, volume: 550_000 },
];

const MOCK_PATTERNS = [
  {
    pattern: 'TSUTSUMI',
    type: 'REVERSAL',
    signal: 'BUY',
    confidence: 0.82,
    description: 'Bullish engulfing — 2nd candle body engulfs the 1st.',
    timestamp: 1720172800000,
    entry: 109,
    stopLoss: 106,
    takeProfit: 115,
  },
];

const MOCK_SETUPS = [
  {
    strategy: 'LIQUIDITY_SWEEP',
    signal: 'SELL',
    entry: 105,
    stopLoss: 110,
    takeProfit: 95,
    riskReward: 2,
    confidence: 0.75,
    patterns: ['SANBASU'],
  },
];

const MOCK_TRADES = [
  {
    id: 'trade_1',
    symbol: 'TCS',
    position: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    quantity: 10,
    pattern: 'MARUBOZU',
    strategy: 'SWING',
    status: 'OPEN',
    exitPrice: null,
    pnl: null,
    notes: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    closedAt: null,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockJson(data: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify({ data }) };
}

function setupMockRoutes(page: Page) {
  // NOTE: must call `route.fulfill()` explicitly — returning a fulfillment
  // object from the handler leaves the request hanging in this Playwright.
  void page.route('**/api/screen*', (route) => route.fulfill(mockJson(MOCK_SCREEN)));
  void page.route('**/api/candles*', (route) => route.fulfill(mockJson(MOCK_CANDLES)));
  void page.route('**/api/patterns*', (route) => route.fulfill(mockJson(MOCK_PATTERNS)));
  void page.route('**/api/setup*', (route) => route.fulfill(mockJson(MOCK_SETUPS)));
  void page.route('**/api/trades*', (route) => route.fulfill(mockJson(MOCK_TRADES)));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dashboard', () => {
  test('renders the layout, controls, and data sections', async ({ page }) => {
    setupMockRoutes(page);
    await page.goto('/dashboard');

    // Heading
    await expect(page.getByRole('heading', { name: /trading dashboard/i })).toBeVisible();

    // Symbol + timeframe selectors
    await expect(page.getByLabel('Symbol')).toBeVisible();
    await expect(page.getByLabel('Timeframe')).toBeVisible();

    // Sections
    await expect(page.getByRole('heading', { name: /price action/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /patterns/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /smart money setups/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /top screeners/i })).toBeVisible();

    // Screening table rows (scope to table cells — RELIANCE/TCS also appear in
    // the symbol `<option>` list and the header subtitle)
    await expect(page.getByRole('cell', { name: 'RELIANCE', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'TCS', exact: true })).toBeVisible();
  });

  test('shows an error state when the API fails', async ({ page }) => {
    // Mock everything with 500 errors.
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    );
    await page.goto('/dashboard');

    await expect(page.getByText(/failed to load market data/i)).toBeVisible();
  });

  test('navigates to trade log via sidebar', async ({ page }) => {
    setupMockRoutes(page);
    await page.goto('/dashboard');

    await page.getByRole('link', { name: /trade log/i }).click();
    await expect(page).toHaveURL(/\/trade-log/);
  });
});

test.describe('Trade Log', () => {
  test('renders status tabs and trade table', async ({ page }) => {
    setupMockRoutes(page);
    await page.goto('/trade-log');

    await expect(page.getByRole('heading', { name: /trade log/i })).toBeVisible();

    // Status tabs
    await expect(page.getByRole('button', { name: /^open$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^closed$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^stopped$/i })).toBeVisible();

    // Table with mock trade
    await expect(page.getByText('TCS').first()).toBeVisible();
  });
});
