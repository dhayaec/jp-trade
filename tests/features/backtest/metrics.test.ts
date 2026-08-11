import { describe, expect, it } from 'vitest';
import type { BacktestTrade } from '@/features/backtest/engine';
import { calculateMetrics } from '@/features/backtest/metrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TradeOverrides = Pick<BacktestTrade, 'pnl' | 'result'> &
  Partial<Omit<BacktestTrade, 'pnl' | 'result'>>;

const BASE_TRADE: Omit<BacktestTrade, 'pnl' | 'result'> = {
  entryIndex: 0,
  exitIndex: 1,
  entryTimestamp: 1,
  exitTimestamp: 2,
  side: 'LONG',
  strategy: 'TEST',
  entry: 100,
  stopLoss: 95,
  takeProfit: 110,
  exit: 100,
  quantity: 1,
};

function trade(overrides: TradeOverrides): BacktestTrade {
  return { ...BASE_TRADE, ...overrides };
}

const INITIAL_CAPITAL = 100_000;

// ---------------------------------------------------------------------------
// Win / loss classification
// ---------------------------------------------------------------------------

describe('classification', () => {
  it('counts wins, losses and breakeven trades', () => {
    const trades = [
      trade({ pnl: 2_000, result: 'WIN' }),
      trade({ pnl: -1_000, result: 'LOSS' }),
      trade({ pnl: 0, result: 'BREAKEVEN' }),
      trade({ pnl: 500, result: 'WIN' }),
    ];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.totalTrades).toBe(4);
    expect(m.wins).toBe(2);
    expect(m.losses).toBe(1);
    expect(m.breakeven).toBe(1);
    expect(m.openTrades).toBe(0);
  });

  it('excludes OPEN trades from win-rate denominator', () => {
    const trades = [trade({ pnl: 1_000, result: 'WIN' }), trade({ pnl: 500, result: 'OPEN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.totalTrades).toBe(1);
    expect(m.openTrades).toBe(1);
    expect(m.wins).toBe(1);
    expect(m.winRate).toBe(1);
  });

  it('returns 0 win rate with no closed trades', () => {
    const m = calculateMetrics([], INITIAL_CAPITAL);
    expect(m.winRate).toBe(0);
    expect(m.totalTrades).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Profit factor
// ---------------------------------------------------------------------------

describe('profit factor', () => {
  it('computes grossProfit / grossLoss', () => {
    const trades = [trade({ pnl: 3_000, result: 'WIN' }), trade({ pnl: -1_000, result: 'LOSS' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.grossProfit).toBeCloseTo(3_000);
    expect(m.grossLoss).toBeCloseTo(1_000);
    expect(m.profitFactor).toBeCloseTo(3);
  });

  it('is Infinity when there are no losses', () => {
    const trades = [trade({ pnl: 1_000, result: 'WIN' }), trade({ pnl: 2_000, result: 'WIN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.profitFactor).toBe(Infinity);
  });

  it('is 0 when there are no profits', () => {
    const trades = [trade({ pnl: -1_000, result: 'LOSS' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.profitFactor).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Max drawdown
// ---------------------------------------------------------------------------

describe('max drawdown', () => {
  it('tracks the peak-to-trough drop on the equity curve', () => {
    // equity: 100k → 95k → 85k → 105k
    // dd 5k, then dd 15k (max), then equity new peak — dd resets.
    const trades = [
      trade({ pnl: -5_000, result: 'LOSS' }),
      trade({ pnl: -10_000, result: 'LOSS' }),
      trade({ pnl: 20_000, result: 'WIN' }),
    ];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.maxDrawdown).toBeCloseTo(15_000);
    expect(m.maxDrawdownPct).toBeCloseTo(0.15); // 15k / 100k peak-at-time
  });

  it('uses the peak at the time of the drop, not the final peak', () => {
    // equity: 100k → 90k (dd=10k, pct=10%) → 120k (new peak) → 110k (dd=10k, pct=8.3%)
    // max drawdown = 10k, but pct = 10% (from first drawdown, peak 100k)
    const trades = [
      trade({ pnl: -10_000, result: 'LOSS' }),
      trade({ pnl: 30_000, result: 'WIN' }),
      trade({ pnl: -10_000, result: 'LOSS' }),
    ];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.maxDrawdown).toBeCloseTo(10_000);
    expect(m.maxDrawdownPct).toBeCloseTo(0.1); // 10k / 100k (not 10k / 120k)
  });

  it('reports 0 drawdown for a pure upstreak', () => {
    const trades = [trade({ pnl: 5_000, result: 'WIN' }), trade({ pnl: 3_000, result: 'WIN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.maxDrawdown).toBe(0);
    expect(m.maxDrawdownPct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Sharpe ratio
// ---------------------------------------------------------------------------

describe('sharpe ratio', () => {
  it('computes mean return / sample stdev for closed trades', () => {
    // Returns: 1000/100000 = 0.01, then 3030/101000 = 0.03
    // mean = 0.02, var = ((0.01-0.02)^2 + (0.03-0.02)^2)/1 = 0.0002
    // stdev = sqrt(0.0002) ≈ 0.014142 → sharpe ≈ sqrt(2)
    const trades = [trade({ pnl: 1_000, result: 'WIN' }), trade({ pnl: 3_030, result: 'WIN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.sharpeRatio).toBeCloseTo(Math.SQRT2, 4);
  });

  it('is 0 with fewer than 2 closed trades', () => {
    const trades = [trade({ pnl: 1_000, result: 'WIN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);
    expect(m.sharpeRatio).toBe(0);
  });

  it('is 0 when returns have zero variance', () => {
    // Running-equity returns: 1000/100000 = 0.01, then 1010/101000 = 0.01.
    // Identical returns → stdev 0 → Sharpe is undefined → reported as 0.
    const trades = [trade({ pnl: 1_000, result: 'WIN' }), trade({ pnl: 1_010, result: 'WIN' })];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);
    expect(m.sharpeRatio).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Averages and expectancy
// ---------------------------------------------------------------------------

describe('averages and expectancy', () => {
  it('computes averageWin, averageLoss and expectancy over closed trades', () => {
    const trades = [
      trade({ pnl: 2_000, result: 'WIN' }),
      trade({ pnl: 4_000, result: 'WIN' }),
      trade({ pnl: -1_000, result: 'LOSS' }),
      trade({ pnl: -500, result: 'LOSS' }),
    ];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);

    expect(m.averageWin).toBeCloseTo(3_000); // (2000+4000)/2
    expect(m.averageLoss).toBeCloseTo(750); // (1000+500)/2 (positive)
    expect(m.expectancy).toBeCloseTo(1_125); // (2000+4000-1000-500)/4
  });

  it('returns 0 for averages when there are no qualifying trades', () => {
    const m = calculateMetrics([], INITIAL_CAPITAL);
    expect(m.averageWin).toBe(0);
    expect(m.averageLoss).toBe(0);
    expect(m.expectancy).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// totalPnl invariant
// ---------------------------------------------------------------------------

describe('totalPnl', () => {
  it('matches the sum of all trade P&L (including OPEN)', () => {
    const trades = [
      trade({ pnl: 1_000, result: 'WIN' }),
      trade({ pnl: -500, result: 'LOSS' }),
      trade({ pnl: 200, result: 'OPEN' }),
    ];
    const m = calculateMetrics(trades, INITIAL_CAPITAL);
    expect(m.totalPnl).toBeCloseTo(700);
  });
});
