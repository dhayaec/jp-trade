import { describe, expect, it } from 'vitest';
import type { Candle, TradingSetup } from '@/features/candlestick/types';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import type { BacktestResult, BacktestStrategy, BacktestTrade } from '@/features/backtest/engine';
import { runBacktest } from '@/features/backtest/engine';
import { expectDefined } from '../../helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let ts = 0;
function nextTs(): number {
  return ++ts;
}

function candle(open: number, high: number, low: number, close: number, volume = 1_000): Candle {
  return { timestamp: nextTs(), open, high, low, close, volume };
}

const BUY: TradingSetup = {
  strategy: 'TEST_BUY',
  signal: 'BUY',
  entry: 100,
  stopLoss: 95,
  takeProfit: 110,
  riskReward: 2,
  confidence: 0.8,
  patterns: ['TEST'],
};

const SHORT: TradingSetup = {
  strategy: 'TEST_SHORT',
  signal: 'SELL',
  entry: 100,
  stopLoss: 105,
  takeProfit: 90,
  riskReward: 2,
  confidence: 0.8,
  patterns: ['TEST'],
};

const NEUTRAL_SETUP: TradingSetup = {
  strategy: 'TEST_NEUTRAL',
  signal: 'NEUTRAL',
  entry: 100,
  stopLoss: 95,
  takeProfit: 110,
  riskReward: 2,
  confidence: 0.5,
  patterns: ['TEST'],
};

function fixed(setup: TradingSetup): BacktestStrategy {
  return () => setup;
}

function firesAt(indices: readonly number[], setup: TradingSetup): BacktestStrategy {
  return (candles) => (indices.includes(candles.length - 1) ? setup : null);
}

/** Assert the trade at `index` exists and return it (narrows `result.trades[i]`). */
function expectTradeAt(result: BacktestResult, index: number): BacktestTrade {
  return expectDefined(result.trades[index]);
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

describe('runBacktest', () => {
  it('records a LONG win when price reaches the take-profit before the stop', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101), // index 0 — entry signal
      candle(101, 112, 99, 111), // index 1 — high 112 ≥ 110 target → WIN
    ];
    const result = runBacktest(data, { strategy: fixed(BUY) });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.side).toBe('LONG');
    expect(trade.result).toBe('WIN');
    expect(trade.entry).toBe(100);
    expect(trade.exit).toBe(110);
    expect(trade.exitIndex).toBe(1);
    expect(trade.pnl).toBeCloseTo(2000); // (110-100) × floor(1000/5)
  });

  it('records a LONG loss when price touches the stop before the target', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 108, 94, 95), // low 94 ≤ 95 stop → LOSS
    ];
    const result = runBacktest(data, { strategy: fixed(BUY) });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.result).toBe('LOSS');
    expect(trade.exit).toBe(95);
    expect(trade.pnl).toBeCloseTo(-1000); // (95-100) × 200
  });

  it('records a SHORT win when price falls to the take-profit', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 103, 88, 89), // low 88 ≤ 90 target → WIN for SHORT
    ];
    const result = runBacktest(data, { strategy: fixed(SHORT) });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.side).toBe('SHORT');
    expect(trade.result).toBe('WIN');
    expect(trade.exit).toBe(90);
    expect(trade.pnl).toBeCloseTo(2000); // (100-90) × 200
  });

  it('resolves as a LOSS when a single bar touches both stop and target (conservative)', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101),
      candle(100, 115, 93, 108), // high 115 ≥ 110 target AND low 93 ≤ 95 stop
    ];
    const result = runBacktest(data, { strategy: fixed(BUY) });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.result).toBe('LOSS');
    expect(trade.exit).toBe(95);
  });

  it('marks the trade as OPEN when no bar resolves the exit', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 108, 96, 105), // high 108 < 110 target, low 96 > 95 stop
    ];
    const result = runBacktest(data, { strategy: fixed(BUY) });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.result).toBe('OPEN');
    expect(trade.exit).toBe(105); // last candle close
    expect(trade.pnl).toBeCloseTo(1000); // (105-100) × 200
  });

  it('skips NEUTRAL signals without entering a trade', () => {
    ts = 0;
    const data = [candle(100, 102, 99, 101), candle(101, 112, 99, 111)];
    const result = runBacktest(data, { strategy: fixed(NEUTRAL_SETUP) });

    expect(result.trades).toHaveLength(0);
    expect(result.initialCapital).toBe(100_000);
    expect(result.finalEquity).toBe(100_000);
  });

  it('reports zero trades for an empty candle array', () => {
    const result = runBacktest([], { strategy: fixed(BUY) });

    expect(result.trades).toHaveLength(0);
    expect(result.initialCapital).toBe(100_000);
    expect(result.finalEquity).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// Signal scanning — resume-after-exit and single-position-at-a-time
// ---------------------------------------------------------------------------

describe('signal scanning', () => {
  it('resumes scanning after a trade closes (skipping signals inside the open trade)', () => {
    ts = 0;
    // Signal fires at index 1 and index 5. Trade 1 (entry index 1) exits at
    // index 3. Signals at indices 2 and 3 are inside the trade and skipped.
    const data = [
      candle(100, 102, 99, 101), // 0 — no signal
      candle(101, 102, 99, 101), // 1 — signal fires → entry 100
      candle(101, 108, 96, 105), // 2 — no exit; signal skipped (inside trade)
      candle(101, 112, 99, 111), // 3 — high ≥ 110 → trade 1 WIN at index 3
      candle(101, 108, 96, 105), // 4 — no signal (firesAt [1,5] = lengths [2,6])
      candle(101, 102, 99, 101), // 5 — signal fires → entry 100
      candle(101, 112, 99, 111), // 6 — high ≥ 110 → trade 2 WIN at index 6
      candle(101, 108, 96, 105), // 7 — not reached
    ];
    const strategy = firesAt([1, 5], BUY);
    const result = runBacktest(data, { strategy });

    expect(result.trades).toHaveLength(2);
    const first = expectTradeAt(result, 0);
    const second = expectTradeAt(result, 1);
    expect(first.entryIndex).toBe(1);
    expect(first.exitIndex).toBe(3);
    expect(second.entryIndex).toBe(5);
    expect(second.exitIndex).toBe(6);
  });

  it('skips signals that fire while a trade is open', () => {
    ts = 0;
    // Fires at indices 1, 2, 5. Trade from 1 exits at 3.
    // Signal at index 2 (inside the open trade) must be skipped.
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 102, 99, 101), // 1 — signal → entry 100
      candle(101, 102, 99, 101), // 2 — signal fires but skipped
      candle(101, 112, 99, 111), // 3 — exit WIN
      candle(101, 108, 96, 105), // 4
      candle(101, 102, 99, 101), // 5 — signal → entry 100
      candle(101, 112, 99, 111), // 6 — exit WIN
    ];
    const strategy = firesAt([1, 2, 5], BUY);
    const result = runBacktest(data, { strategy });

    expect(result.trades).toHaveLength(2);
    expect(expectTradeAt(result, 0).entryIndex).toBe(1);
    expect(expectTradeAt(result, 1).entryIndex).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Position sizing edge cases
// ---------------------------------------------------------------------------

describe('position sizing', () => {
  it('skips signals that produce an unsizable position (invalid stop side)', () => {
    ts = 0;
    const badStop: TradingSetup = { ...BUY, signal: 'BUY', stopLoss: 105 }; // stop above entry for LONG
    const data = [candle(100, 102, 99, 101), candle(101, 112, 99, 111)];
    const result = runBacktest(data, { strategy: fixed(badStop) });

    expect(result.trades).toHaveLength(0);
    expect(result.finalEquity).toBe(100_000);
  });
});

// ---------------------------------------------------------------------------
// Data ordering
// ---------------------------------------------------------------------------

describe('candle ordering', () => {
  it('sorts candles by timestamp ascending before processing', () => {
    ts = 0;
    const data = [
      candle(100, 102, 99, 101), // ts 3
      candle(101, 112, 99, 111), // ts 2 — signal fires here (sorted index 1)
      candle(100, 102, 99, 101), // ts 1
    ];
    // After sort: ts 1 (idx 0), ts 2 (idx 1), ts 3 (idx 2)
    // Strategy fires at sorted index 1 (length 2) — signal ts 2.
    const strategy = firesAt([1], { ...BUY, entry: 100 });
    const result = runBacktest(data, { strategy });

    expect(result.trades).toHaveLength(1);
    // Sorted order: ts=1, ts=2, ts=3 → signal at idx 1 (ts=2), scan from idx 2.
    expect(expectTradeAt(result, 0).entryIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Equity tracking
// ---------------------------------------------------------------------------

describe('equity tracking', () => {
  it('tracks equity across sequential trades', () => {
    ts = 0;
    // Trade 1: WIN, exit 110 → qty 200, +2000 pnl. equity = 102000.
    // Trade 2: fires after trade 1 closes, also WIN — position size scales with
    // equity: risk 1% of 102000 = 1020, qty = floor(1020/5) = 204, +2040 pnl. equity = 104040.
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 112, 99, 111), // trade 1 WIN (exit 110)
      candle(101, 102, 99, 101),
      candle(101, 112, 99, 111), // trade 2 WIN (exit 110)
    ];
    const strategy = firesAt([0, 2], BUY);
    const result = runBacktest(data, { strategy });

    expect(result.trades).toHaveLength(2);
    expect(expectTradeAt(result, 0).pnl).toBeCloseTo(2000);
    expect(expectTradeAt(result, 1).pnl).toBeCloseTo(2040);
    expect(result.finalEquity).toBeCloseTo(104_040);
  });
});

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

describe('default options', () => {
  it('uses initialCapital 100_000 and riskPerTradePct 0.01 by default', () => {
    ts = 0;
    const data = [candle(100, 102, 99, 101), candle(101, 112, 99, 111)];
    const result = runBacktest(data, { strategy: fixed(BUY) });

    expect(result.initialCapital).toBe(100_000);
    // riskAmount = 1000, riskPerUnit = |100-95| = 5, qty = floor(1000/5) = 200
    expect(expectTradeAt(result, 0).quantity).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Integration with a real strategy detector
// ---------------------------------------------------------------------------

describe('real-strategy integration', () => {
  it('enters a SHORT trade via detectLiquiditySweep and hits the target', () => {
    ts = 0;
    // Reproduce the exact SELL setup from the strategies test suite (indices 1–9).
    // The setup fires at the 9th candle; continue the series so the target is
    // reached before the stop.
    //
    // SELL: entry 100, stop 110×1.005 = 110.55, takeProfit 100 − 10.55×2 = 78.9
    const setupCandles: Candle[] = [
      { timestamp: 1, open: 90, high: 91, low: 89, close: 90.5, volume: 1_000 },
      { timestamp: 2, open: 90.5, high: 91.5, low: 89.5, close: 91, volume: 1_000 },
      { timestamp: 3, open: 91, high: 92, low: 90, close: 91.5, volume: 1_000 },
      { timestamp: 4, open: 91.5, high: 92.5, low: 90.5, close: 92, volume: 1_000 },
      { timestamp: 5, open: 92, high: 93, low: 91, close: 92.5, volume: 1_000 },
      { timestamp: 6, open: 100, high: 102, low: 99, close: 101, volume: 1_000 },
      { timestamp: 7, open: 101, high: 103, low: 100, close: 102, volume: 1_000 },
      { timestamp: 8, open: 102, high: 105, low: 101, close: 104, volume: 1_000 },
      { timestamp: 9, open: 105, high: 110, low: 100, close: 100, volume: 1_000 },
    ];
    // Continuation: bars that push price down to the target 78.9 without hitting
    // stop 110.55.
    const continuation: Candle[] = [
      { timestamp: 10, open: 100, high: 100.5, low: 78, close: 80, volume: 1_000 },
    ];
    const allCandles = [...setupCandles, ...continuation];
    const result = runBacktest(allCandles, {
      strategy: detectLiquiditySweep,
      initialCapital: 100_000,
    });

    expect(result.trades).toHaveLength(1);
    const trade = expectTradeAt(result, 0);
    expect(trade.side).toBe('SHORT');
    expect(trade.result).toBe('WIN');
    expect(trade.entry).toBe(100);
    expect(trade.exit).toBeCloseTo(78.9);
    expect(trade.strategy).toBe('LIQUIDITY_SWEEP');
    expect(trade.pnl).toBeGreaterThan(0);
  });
});
