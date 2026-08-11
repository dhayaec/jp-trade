import { describe, expect, it } from 'vitest';
import { calculateATR, calculateRSI } from '@/features/candlestick/indicators';
import type { Candle } from '@/features/candlestick/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function candle(
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1_000,
  timestamp = 0
): Candle {
  return { timestamp, open, high, low, close, volume };
}

function risingCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => candle(i, i, i, i + 1, 1_000, i));
}

function fallingCandles(n: number): Candle[] {
  // close decreases with each bar → every change is a loss.
  return Array.from({ length: n }, (_, i) =>
    candle(n - i + 1, n - i + 1, n - i + 1, n - i, 1_000, i)
  );
}

function flatCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => candle(50, 55, 45, 50, 1_000, i));
}

// ---------------------------------------------------------------------------
// RSI
// ---------------------------------------------------------------------------

describe('calculateRSI', () => {
  it('returns 50 for empty input', () => {
    expect(calculateRSI([])).toBe(50);
  });

  it('returns 50 when fewer than period + 1 candles', () => {
    expect(calculateRSI(risingCandles(14))).toBe(50);
  });

  it('returns 100 when all changes are gains', () => {
    expect(calculateRSI(risingCandles(15))).toBe(100);
  });

  it('returns 0 when all changes are losses', () => {
    expect(calculateRSI(fallingCandles(15))).toBe(0);
  });

  it('returns 50 for a flat series (no change)', () => {
    expect(calculateRSI(flatCandles(15))).toBe(50);
  });

  it('computes a value in (0, 100) for a mixed series', () => {
    const mixed: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + (i % 2 === 0 ? i : -i);
      mixed.push(candle(base, base + 2, base - 2, base, 1_000, i));
    }
    const rsi = calculateRSI(mixed);
    expect(rsi).toBeGreaterThan(0);
    expect(rsi).toBeLessThan(100);
  });

  it('honours a custom period', () => {
    const rsi = calculateRSI(risingCandles(6), 5);
    expect(rsi).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// ATR
// ---------------------------------------------------------------------------

describe('calculateATR', () => {
  it('returns 0 for empty input', () => {
    expect(calculateATR([])).toBe(0);
  });

  it('returns 0 when fewer than period + 1 candles', () => {
    expect(calculateATR(risingCandles(14))).toBe(0);
  });

  it('computes ATR for a normal series', () => {
    // 15 candles, every bar: open 0, high 10, low 8, close 9
    //   First bar TR = 10 - 8 = 2.
    //   Subsequent bars TR = max(2, |10-9|=1, |8-9|=1) = 2.
    //   ATR over 14 bars = 2.
    const candles: Candle[] = [candle(0, 10, 8, 9, 1_000, 0)];
    for (let i = 1; i < 15; i++) {
      candles.push(candle(9, 10, 8, 9, 1_000, i));
    }
    expect(calculateATR(candles)).toBe(2);
  });
});
