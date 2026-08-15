import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * API route-handler tests. No database: `@/server/db` is mocked so each handler
 * queries an in-memory fake Prisma client. Covers input validation (400), the
 * happy path (200/201), Decimal/BigInt serialization, and Prisma call shapes.
 */

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  candle: { findMany: vi.fn() },
  stockSymbol: { findMany: vi.fn() },
  trade: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/server/db', () => ({
  getPrisma: () => mockPrisma,
}));

// Handlers import `getPrisma` lazily inside the request, so they resolve against
// the mocked module above. Imported here, after the mock is registered.
import { GET as candlesGET } from '@/app/api/candles/route';
import { GET as patternsGET } from '@/app/api/patterns/route';
import { GET as setupGET } from '@/app/api/setup/route';
import { GET as screenGET } from '@/app/api/screen/route';
import { GET as tradesGET, POST as tradesPOST } from '@/app/api/trades/route';
import { PATCH as tradesPATCH } from '@/app/api/trades/[id]/route';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface DbCandleRow {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function dbCandle(
  timestamp: Date,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1_000
): DbCandleRow {
  return { timestamp, open, high, low, close, volume };
}

const CANDLE_ROWS = [
  dbCandle(new Date('2026-08-01T00:00:00Z'), 100, 105, 99, 104, 1_000_000),
  dbCandle(new Date('2026-07-31T00:00:00Z'), 99, 102, 98, 101, 900_000),
];

/** Two candles whose second bullishly engulfs the first → a TSUTSUMI signal. */
const TSUTSUMI_CANDLES = [
  dbCandle(new Date('2026-08-01T00:00:00Z'), 100, 100.5, 98.5, 99),
  dbCandle(new Date('2026-08-02T00:00:00Z'), 98, 103, 97.5, 103),
];

/** A liquidity-sweep SELL setup (SanSen rise → sweep → bearish engulfing). */
const LIQUIDITY_SWEEP_CANDLES = [
  dbCandle(new Date('2026-08-01T00:00:00Z'), 90, 91, 89, 90.5),
  dbCandle(new Date('2026-08-02T00:00:00Z'), 90.5, 91.5, 89.5, 91),
  dbCandle(new Date('2026-08-03T00:00:00Z'), 91, 92, 90, 91.5),
  dbCandle(new Date('2026-08-04T00:00:00Z'), 91.5, 92.5, 90.5, 92),
  dbCandle(new Date('2026-08-05T00:00:00Z'), 92, 93, 91, 92.5),
  dbCandle(new Date('2026-08-06T00:00:00Z'), 100, 102, 99, 101),
  dbCandle(new Date('2026-08-07T00:00:00Z'), 101, 103, 100, 102),
  dbCandle(new Date('2026-08-08T00:00:00Z'), 102, 105, 101, 104),
  dbCandle(new Date('2026-08-09T00:00:00Z'), 105, 110, 100, 100),
];

const TRADE_ROW = {
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
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  closedAt: null,
};

/** Generate a choppy up-then-flat series long enough for the screener (≥ 21). */
function screenerSeries(n: number, start = 100, volume = 1_000): DbCandleRow[] {
  const candles: DbCandleRow[] = [];
  let close = start;
  for (let i = 1; i <= n; i++) {
    const open = close;
    const nextClose = open + (i % 3 === 0 ? -0.5 : 0.8);
    candles.push(
      dbCandle(
        new Date(Date.UTC(2026, 0, i)),
        open,
        Math.max(open, nextClose) + 0.5,
        Math.min(open, nextClose) - 0.5,
        nextClose,
        volume
      )
    );
    close = nextClose;
  }
  return candles;
}

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

function jsonResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>;
}

/** Valid POST /api/trades body (accountEquity required by the risk engine). */
function tradeCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    symbol: 'TCS',
    position: 'LONG',
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    quantity: 10,
    pattern: 'MARUBOZU',
    strategy: 'SWING',
    accountEquity: 100_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.candle.findMany.mockResolvedValue(CANDLE_ROWS);
  mockPrisma.stockSymbol.findMany.mockResolvedValue([{ symbol: 'AAA' }, { symbol: 'BBB' }]);
  mockPrisma.trade.findMany.mockResolvedValue([TRADE_ROW]);
  mockPrisma.trade.count.mockResolvedValue(0);
  mockPrisma.trade.findUnique.mockResolvedValue(TRADE_ROW);
  mockPrisma.trade.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...TRADE_ROW, ...data })
  );
  mockPrisma.trade.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...TRADE_ROW, ...data, id: 'trade_new' })
  );
});

// ---------------------------------------------------------------------------
// GET /api/candles
// ---------------------------------------------------------------------------

describe('GET /api/candles', () => {
  it('returns serialized candles newest-first', async () => {
    const res = await candlesGET(makeRequest('http://localhost:3000/api/candles?symbol=TCS'));
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    expect(body).toHaveProperty('data');
    expect(body.data).toEqual([
      {
        timestamp: new Date('2026-08-01T00:00:00Z').getTime(),
        open: 100,
        high: 105,
        low: 99,
        close: 104,
        volume: 1_000_000,
      },
      {
        timestamp: new Date('2026-07-31T00:00:00Z').getTime(),
        open: 99,
        high: 102,
        low: 98,
        close: 101,
        volume: 900_000,
      },
    ]);

    // Query passes through the validated params (defaults applied).
    expect(mockPrisma.candle.findMany).toHaveBeenCalledWith({
      where: { symbol: 'TCS', timeframe: '1d' },
      orderBy: { timestamp: 'desc' },
      take: 100,
      skip: 0,
    });
  });

  it('rejects a request without a symbol', async () => {
    const res = await candlesGET(makeRequest('http://localhost:3000/api/candles'));
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('symbol');

    expect(mockPrisma.candle.findMany).not.toHaveBeenCalled();
  });

  it('returns a 500 when the database query fails', async () => {
    mockPrisma.candle.findMany.mockRejectedValue(new Error('connection refused'));
    const res = await candlesGET(makeRequest('http://localhost:3000/api/candles?symbol=TCS'));
    expect(res.status).toBe(500);
    expect((await jsonResponse(res)).error).toContain('Failed to fetch candles');
  });
});

// ---------------------------------------------------------------------------
// GET /api/patterns
// ---------------------------------------------------------------------------

describe('GET /api/patterns', () => {
  it('returns engine signals above the confidence floor', async () => {
    mockPrisma.candle.findMany.mockResolvedValue(TSUTSUMI_CANDLES);
    const res = await patternsGET(makeRequest('http://localhost:3000/api/patterns?symbol=TCS'));
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    const signals = body.data as Array<{ pattern: string; signal: string }>;
    expect(signals).toHaveLength(1);
    expect(signals[0].pattern).toBe('TSUTSUMI');
    expect(signals[0].signal).toBe('BUY');
  });

  it('returns an empty array when no pattern fires', async () => {
    mockPrisma.candle.findMany.mockResolvedValue([]);
    const res = await patternsGET(makeRequest('http://localhost:3000/api/patterns?symbol=TCS'));
    expect(res.status).toBe(200);
    expect((await jsonResponse(res)).data).toEqual([]);
  });

  it('rejects an invalid timeframe', async () => {
    const res = await patternsGET(
      makeRequest('http://localhost:3000/api/patterns?symbol=TCS&timeframe=3h')
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.candle.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/setup
// ---------------------------------------------------------------------------

describe('GET /api/setup', () => {
  it('returns a liquidity-sweep setup when one fires', async () => {
    mockPrisma.candle.findMany.mockResolvedValue(LIQUIDITY_SWEEP_CANDLES);
    const res = await setupGET(makeRequest('http://localhost:3000/api/setup?symbol=TCS'));
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    const setups = body.data as Array<{ strategy: string; signal: string; entry: number }>;
    expect(setups).toHaveLength(1);
    expect(setups[0].strategy).toBe('LIQUIDITY_SWEEP');
    expect(setups[0].signal).toBe('SELL');
    expect(setups[0].entry).toBe(100);
  });

  it('returns an empty array when no setup fires', async () => {
    mockPrisma.candle.findMany.mockResolvedValue([]);
    const res = await setupGET(makeRequest('http://localhost:3000/api/setup?symbol=TCS'));
    expect(res.status).toBe(200);
    expect((await jsonResponse(res)).data).toEqual([]);
  });

  it('rejects a request without a symbol', async () => {
    const res = await setupGET(makeRequest('http://localhost:3000/api/setup'));
    expect(res.status).toBe(400);
    expect(mockPrisma.candle.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/screen
// ---------------------------------------------------------------------------

describe('GET /api/screen', () => {
  it('screens the active universe and returns ranked candidates', async () => {
    mockPrisma.candle.findMany.mockImplementation(({ where }: { where: { symbol: string } }) =>
      Promise.resolve(
        where.symbol === 'AAA' ? screenerSeries(30, 100, 1_000) : screenerSeries(30, 100, 600)
      )
    );

    const res = await screenGET(
      makeRequest(
        'http://localhost:3000/api/screen?minScore=0&topN=10&minVolumeRatio=0.1&minRsi=0&maxRsi=100'
      )
    );
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    const candidates = body.data as Array<{ symbol: string; score: number; lastClose: number }>;
    expect(candidates.map((c) => c.symbol)).toEqual(['AAA', 'BBB']);

    for (const c of candidates) {
      expect(c).toEqual(
        expect.objectContaining({
          score: expect.any(Number),
          volumeRatio: expect.any(Number),
          rsi: expect.any(Number),
          patternCount: expect.any(Number),
          isORB: expect.any(Boolean),
          lastClose: expect.any(Number),
        })
      );
    }

    // One candle fetch per active symbol.
    expect(mockPrisma.candle.findMany).toHaveBeenCalledTimes(2);
  });

  it('fetches only active symbols from the universe', async () => {
    await screenGET(makeRequest('http://localhost:3000/api/screen'));
    expect(mockPrisma.stockSymbol.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { symbol: true },
    });
  });

  it('applies a minScore filter', async () => {
    mockPrisma.candle.findMany.mockResolvedValue(screenerSeries(30));
    const res = await screenGET(makeRequest('http://localhost:3000/api/screen?minScore=100'));
    expect(res.status).toBe(200);
    expect((await jsonResponse(res)).data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/trades
// ---------------------------------------------------------------------------

describe('GET /api/trades', () => {
  it('lists open trades by default, newest first', async () => {
    const res = await tradesGET(makeRequest('http://localhost:3000/api/trades'));
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    const trades = body.data as Array<{ id: string; entry: number; createdAt: string }>;
    expect(trades).toHaveLength(1);
    expect(trades[0]).toEqual({
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
    });

    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('filters by symbol and status when provided', async () => {
    await tradesGET(makeRequest('http://localhost:3000/api/trades?symbol=TCS&status=CLOSED'));
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
      where: { symbol: 'TCS', status: 'CLOSED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('rejects an unknown status', async () => {
    const res = await tradesGET(makeRequest('http://localhost:3000/api/trades?status=PENDING'));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/trades
// ---------------------------------------------------------------------------

describe('POST /api/trades', () => {
  it('creates a trade and returns it with 201', async () => {
    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          symbol: 'TCS',
          position: 'LONG',
          entry: 100,
          stopLoss: 95,
          takeProfit: 110,
          quantity: 10,
          pattern: 'MARUBOZU',
          strategy: 'SWING',
          accountEquity: 100_000,
        }),
      })
    );
    expect(res.status).toBe(201);

    const body = await jsonResponse(res);
    expect(body.data).toEqual(
      expect.objectContaining({
        id: 'trade_new',
        symbol: 'TCS',
        entry: 100,
        createdAt: '2026-08-01T00:00:00.000Z',
      })
    );

    // `notes` is omitted → persisted as null.
    expect(mockPrisma.trade.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symbol: 'TCS',
        position: 'LONG',
        entry: 100,
        notes: null,
      }),
    });
  });

  it('rejects a body missing required fields', async () => {
    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: 'TCS', position: 'LONG' }),
      })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      })
    );
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('Invalid JSON');
  });

  it('rejects a body missing accountEquity', async () => {
    const withoutEquity = { ...tradeCreateBody() };
    delete withoutEquity.accountEquity;
    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(withoutEquity),
      })
    );
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('accountEquity');
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('returns 409 when a risk limit blocks the trade', async () => {
    mockPrisma.trade.count.mockResolvedValue(3); // max active trades reached

    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(tradeCreateBody()),
      })
    );
    expect(res.status).toBe(409);
    expect((await jsonResponse(res)).reason).toBe('MAX_ACTIVE_TRADES');
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the quantity exceeds the 1% risk cap', async () => {
    const res = await tradesPOST(
      makeRequest('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(tradeCreateBody({ quantity: 999 })),
      })
    );
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('exceeds the 1% risk cap');
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/trades/:id — update risk fields or close
// ---------------------------------------------------------------------------

describe('PATCH /api/trades/:id', () => {
  const patch = (id: string, body: unknown) =>
    tradesPATCH(
      makeRequest(`http://localhost:3000/api/trades/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    );

  it('updates the stop loss on an open trade', async () => {
    const res = await patch('trade_1', { stopLoss: 105 });
    expect(res.status).toBe(200);

    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { stopLoss: 105 },
    });
  });

  it('clamps a stop below breakeven up to entry', async () => {
    // TRADE_ROW entry is 100; a LONG stop of 92 must snap to 100.
    const res = await patch('trade_1', { stopLoss: 92 });
    expect(res.status).toBe(200);

    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { stopLoss: 100 },
    });
  });

  it('closes the trade and returns the computed P&L', async () => {
    const res = await patch('trade_1', { exitPrice: 110 });
    expect(res.status).toBe(200);

    const body = await jsonResponse(res);
    // (110 − 100) × 10 = +100; mock resolves TRADE_ROW spread with data.
    expect(body.data).toEqual(
      expect.objectContaining({ status: 'CLOSED', exitPrice: 110, pnl: 100 })
    );
  });

  it('returns 404 for an unknown trade', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(null);
    const res = await patch('missing', { stopLoss: 105 });
    expect(res.status).toBe(404);
    expect((await jsonResponse(res)).error).toContain('Trade not found');
  });

  it('returns 400 when the trade is not open', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue({ ...TRADE_ROW, status: 'CLOSED' });
    const res = await patch('trade_1', { stopLoss: 105 });
    expect(res.status).toBe(400);
    expect((await jsonResponse(res)).error).toContain('is not open');
  });

  it('returns 400 for an invalid body', async () => {
    const res = await patch('trade_1', {});
    expect(res.status).toBe(400);
    expect(mockPrisma.trade.findUnique).not.toHaveBeenCalled();
  });
});
