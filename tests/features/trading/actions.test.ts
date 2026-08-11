import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Trade-lifecycle tests (open / close / update) against a mocked Prisma client.
 * The pure risk rules in `risk.ts` are exercised through the service boundary:
 * these tests pin the behaviour a route handler sees — the typed errors it maps
 * to HTTP status codes.
 */

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------

const mockPrisma = {
  trade: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@/server/db', () => ({
  getPrisma: () => mockPrisma,
}));

// Imported after the mock is registered so `getPrisma()` resolves to it.
import { closeTrade, openTrade, updateTrade } from '@/features/trading/actions';
import {
  InvalidStopError,
  PositionSizeError,
  TradeLimitError,
  TradeNotOpenError,
  TradeNotFoundError,
} from '@/features/trading/actions';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A fixed "now" inside an IST trading day: 2026-08-11T09:00:00Z (14:30 IST). */
const NOW = new Date('2026-08-11T09:00:00Z');

/** Start of the IST day containing NOW: 2026-08-10T18:30Z. */
const DAY_START = new Date('2026-08-10T18:30:00Z');

interface TradeRow {
  id: string;
  symbol: string;
  position: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pattern: string;
  strategy: string;
  status: string;
  exitPrice: number | null;
  pnl: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

function tradeRow(overrides: Partial<TradeRow> = {}): TradeRow {
  return {
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
    ...overrides,
  };
}

const TRADE = tradeRow();

/** Valid `openTrade` input: 1% of 100k = 1000, risk 5/share → cap 200. */
function validDraft() {
  return {
    symbol: 'TCS',
    position: 'LONG' as const,
    entry: 100,
    stopLoss: 95,
    takeProfit: 110,
    quantity: 10,
    pattern: 'MARUBOZU',
    strategy: 'SWING',
  };
}

const validOptions = { accountEquity: 100_000, now: NOW };

beforeEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// openTrade
// ---------------------------------------------------------------------------

describe('openTrade', () => {
  it('opens a trade when under the limits and within the 1% risk cap', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]); // nothing closed today
    mockPrisma.trade.create.mockResolvedValue(TRADE);

    await openTrade(validDraft(), validOptions);

    // Daily limits are read against the IST day boundary.
    expect(mockPrisma.trade.count).toHaveBeenCalledWith({ where: { status: 'OPEN' } });
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
      where: { closedAt: { gte: DAY_START }, status: { not: 'OPEN' } },
      select: { pnl: true },
    });

    expect(mockPrisma.trade.create).toHaveBeenCalledWith({
      data: {
        symbol: 'TCS',
        position: 'LONG',
        entry: 100,
        stopLoss: 95,
        takeProfit: 110,
        quantity: 10,
        pattern: 'MARUBOZU',
        strategy: 'SWING',
        notes: null,
      },
    });
  });

  it('throws TradeLimitError when max active trades is reached', async () => {
    mockPrisma.trade.count.mockResolvedValue(3);
    mockPrisma.trade.findMany.mockResolvedValue([]);

    await expect(openTrade(validDraft(), validOptions)).rejects.toThrow(TradeLimitError);
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('throws TradeLimitError when the daily loss halt is hit', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    // −2 000 realised today = 2% of 100k.
    mockPrisma.trade.findMany.mockResolvedValue([{ pnl: -1_200 }, { pnl: -800 }]);

    const err = await openTrade(validDraft(), validOptions).catch((e) => e);
    expect(err).toBeInstanceOf(TradeLimitError);
    expect(err.reason).toBe('DAILY_LOSS_LIMIT');
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('queries only trades closed since the IST day start', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);
    mockPrisma.trade.create.mockResolvedValue(TRADE);

    await openTrade(validDraft(), validOptions);
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
      where: { closedAt: { gte: DAY_START }, status: { not: 'OPEN' } },
      select: { pnl: true },
    });
  });

  it('throws PositionSizeError when the quantity exceeds the 1% cap', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);

    const draft = validDraft();
    draft.quantity = 201; // cap is 200 at 1% of 100k with a 5-point stop

    const err = await openTrade(draft, validOptions).catch((e) => e);
    expect(err).toBeInstanceOf(PositionSizeError);
    expect(err.maxQuantity).toBe(200);
    expect(mockPrisma.trade.create).not.toHaveBeenCalled();
  });

  it('throws PositionSizeError with maxQuantity 0 when no position is affordable', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);

    // 1% of 100 = 1; a 5-point stop leaves a 0-share cap.
    const err = await openTrade(validDraft(), { accountEquity: 100, now: NOW }).catch((e) => e);
    expect(err).toBeInstanceOf(PositionSizeError);
    expect(err.maxQuantity).toBe(0);
  });

  it('throws InvalidStopError when the stop is on the wrong side of entry', async () => {
    const draft = validDraft();
    draft.stopLoss = 105; // LONG stop above entry

    await expect(openTrade(draft, validOptions)).rejects.toThrow(InvalidStopError);
    expect(mockPrisma.trade.count).not.toHaveBeenCalled();
  });

  it('throws TradeError when accountEquity is non-positive', async () => {
    await expect(openTrade(validDraft(), { accountEquity: 0, now: NOW })).rejects.toThrow(
      'accountEquity must be positive'
    );
  });

  it('respects a custom riskPerTradePct option', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);
    mockPrisma.trade.create.mockResolvedValue(TRADE);

    // 2% of 100k = 2000 / 5-point stop → cap 400.
    const draft = validDraft();
    draft.quantity = 400;

    await expect(openTrade(draft, { ...validOptions, riskPerTradePct: 0.02 })).resolves.toBe(TRADE);
  });

  it('closes the previous IST day when now is after midnight IST', async () => {
    mockPrisma.trade.count.mockResolvedValue(0);
    mockPrisma.trade.findMany.mockResolvedValue([]);
    mockPrisma.trade.create.mockResolvedValue(TRADE);

    // 2026-08-11T20:00Z → 2026-08-12 01:30 IST → dayStart 2026-08-11T18:30Z.
    await openTrade(validDraft(), { ...validOptions, now: new Date('2026-08-11T20:00:00Z') });
    expect(mockPrisma.trade.findMany).toHaveBeenCalledWith({
      where: { closedAt: { gte: new Date('2026-08-11T18:30:00Z') }, status: { not: 'OPEN' } },
      select: { pnl: true },
    });
  });
});

// ---------------------------------------------------------------------------
// closeTrade
// ---------------------------------------------------------------------------

describe('closeTrade', () => {
  it('closes a LONG trade, computing P&L and stamping closedAt', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(TRADE);
    mockPrisma.trade.update.mockResolvedValue({ ...TRADE, status: 'CLOSED' });

    await closeTrade('trade_1', { exitPrice: 110, now: NOW });

    // (110 − 100) × 10 = +100.
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { status: 'CLOSED', exitPrice: 110, pnl: 100, closedAt: NOW },
    });
  });

  it('computes a loss for a SHORT stopped out', async () => {
    const short = tradeRow({ position: 'SHORT', entry: 100, stopLoss: 105, takeProfit: 95 });
    mockPrisma.trade.findUnique.mockResolvedValue(short);
    mockPrisma.trade.update.mockResolvedValue({ ...short, status: 'STOPPED' });

    await closeTrade('trade_1', { exitPrice: 105, status: 'STOPPED', now: NOW });

    // (100 − 105) × 10 = −50.
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { status: 'STOPPED', exitPrice: 105, pnl: -50, closedAt: NOW },
    });
  });

  it('throws TradeNotFoundError for an unknown id', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(null);
    await expect(closeTrade('missing', { exitPrice: 110 })).rejects.toThrow(TradeNotFoundError);
    expect(mockPrisma.trade.update).not.toHaveBeenCalled();
  });

  it('throws TradeNotOpenError when the trade is already closed', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(tradeRow({ status: 'CLOSED' }));
    await expect(closeTrade('trade_1', { exitPrice: 110 })).rejects.toThrow(TradeNotOpenError);
    expect(mockPrisma.trade.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateTrade
// ---------------------------------------------------------------------------

describe('updateTrade', () => {
  it('tightens a trailing stop for a LONG', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(TRADE);
    mockPrisma.trade.update.mockResolvedValue({ ...TRADE, stopLoss: 105 });

    await updateTrade('trade_1', { stopLoss: 105 });
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { stopLoss: 105 },
    });
  });

  it('clamps a LONG stop below breakeven up to entry', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(TRADE); // entry 100
    mockPrisma.trade.update.mockResolvedValue(TRADE);

    await updateTrade('trade_1', { stopLoss: 92 });
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { stopLoss: 100 },
    });
  });

  it('clamps a SHORT stop above breakeven down to entry', async () => {
    const short = tradeRow({ position: 'SHORT', entry: 100, stopLoss: 105 });
    mockPrisma.trade.findUnique.mockResolvedValue(short);
    mockPrisma.trade.update.mockResolvedValue(short);

    await updateTrade('trade_1', { stopLoss: 108 });
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { stopLoss: 100 },
    });
  });

  it('updates takeProfit and notes without touching the stop', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(TRADE);
    mockPrisma.trade.update.mockResolvedValue(TRADE);

    await updateTrade('trade_1', { takeProfit: 120, notes: 'trimmed' });
    expect(mockPrisma.trade.update).toHaveBeenCalledWith({
      where: { id: 'trade_1' },
      data: { takeProfit: 120, notes: 'trimmed' },
    });
  });

  it('throws TradeNotFoundError for an unknown id', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(null);
    await expect(updateTrade('missing', { notes: 'x' })).rejects.toThrow(TradeNotFoundError);
  });

  it('throws TradeNotOpenError when the trade is closed', async () => {
    mockPrisma.trade.findUnique.mockResolvedValue(tradeRow({ status: 'STOPPED' }));
    await expect(updateTrade('trade_1', { notes: 'x' })).rejects.toThrow(TradeNotOpenError);
  });
});
