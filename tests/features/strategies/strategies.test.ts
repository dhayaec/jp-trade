import { describe, expect, it } from 'vitest';
import type { Candle, TradingSetup } from '@/features/candlestick/types';
import { detectLiquiditySweep } from '@/features/strategies/liquidity-sweep';
import { detectFairValueGap } from '@/features/strategies/fair-value-gap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function candle(timestamp: number, open: number, high: number, low: number, close: number): Candle {
  return { timestamp, open, high, low, close, volume: 1_000 };
}

// ---------------------------------------------------------------------------
// Liquidity Sweep (SanSen + Tsutsumi + Sweep)
// ---------------------------------------------------------------------------

describe('detectLiquiditySweep', () => {
  it('detects a SELL setup when an uptrend sweeps above a recent high and rejects', () => {
    // Base drift at 90–92, then three advancing bullish lines (SanSen) to a
    // high of 105, then the signal candle pierces 110 and closes back at 100.
    const candles: Candle[] = [
      candle(1, 90, 91, 89, 90.5),
      candle(2, 90.5, 91.5, 89.5, 91),
      candle(3, 91, 92, 90, 91.5),
      candle(4, 91.5, 92.5, 90.5, 92),
      candle(5, 92, 93, 91, 92.5),
      candle(6, 100, 102, 99, 101), // SanSen 1
      candle(7, 101, 103, 100, 102), // SanSen 2
      candle(8, 102, 105, 101, 104), // SanSen 3
      candle(9, 105, 110, 100, 100), // sweep + bearish engulfing
    ];

    const setup = detectLiquiditySweep(candles);
    expect(setup).not.toBeNull();
    expect(setup!.strategy).toBe('LIQUIDITY_SWEEP');
    expect(setup!.signal).toBe('SELL');
    expect(setup!.entry).toBe(100);
    expect(setup!.stopLoss).toBeCloseTo(110 * 1.005);
    expect(setup!.takeProfit).toBeCloseTo(100 - 10.55 * 2);
    expect(setup!.riskReward).toBe(2);
    expect(setup!.patterns).toEqual(['SANSEN', 'LIQUIDITY_SWEEP', 'TSUTSUMI']);
  });

  it('detects a BUY setup when a downtrend sweeps below a recent low and rejects', () => {
    const candles: Candle[] = [
      candle(1, 100, 101, 99, 100.5),
      candle(2, 100.5, 101.5, 99.5, 101),
      candle(3, 101, 102, 100, 101.5),
      candle(4, 101.5, 102.5, 100.5, 102),
      candle(5, 102, 103, 101, 102.5),
      candle(6, 100, 101, 97, 98), // SanSen 1
      candle(7, 98, 99, 95, 96), // SanSen 2
      candle(8, 96, 97, 93, 94), // SanSen 3
      candle(9, 92, 103, 88, 100), // sweep + bullish engulfing
    ];

    const setup = detectLiquiditySweep(candles);
    expect(setup).not.toBeNull();
    expect(setup!.signal).toBe('BUY');
    expect(setup!.entry).toBe(100);
    expect(setup!.stopLoss).toBeCloseTo(88 * 0.995);
    expect(setup!.takeProfit).toBeCloseTo(100 + (100 - 88 * 0.995) * 2);
  });

  it('returns null when there is no sweep through the recent extreme', () => {
    const candles: Candle[] = [
      candle(1, 90, 91, 89, 90.5),
      candle(2, 90.5, 91.5, 89.5, 91),
      candle(3, 91, 92, 90, 91.5),
      candle(4, 91.5, 92.5, 90.5, 92),
      candle(5, 92, 93, 91, 92.5),
      candle(6, 100, 102, 99, 101),
      candle(7, 101, 103, 100, 102),
      candle(8, 102, 105, 101, 104),
      candle(9, 102, 104, 100, 101), // high 104 < 105 — no sweep
    ];

    expect(detectLiquiditySweep(candles)).toBeNull();
  });

  it('returns null when the sweep candle does not close back beyond the extreme', () => {
    const candles: Candle[] = [
      candle(1, 90, 91, 89, 90.5),
      candle(2, 90.5, 91.5, 89.5, 91),
      candle(3, 91, 92, 90, 91.5),
      candle(4, 91.5, 92.5, 90.5, 92),
      candle(5, 92, 93, 91, 92.5),
      candle(6, 100, 102, 99, 101),
      candle(7, 101, 103, 100, 102),
      candle(8, 102, 105, 101, 104),
      candle(9, 104, 110, 103, 107), // sweeps to 110 but closes above 105
    ];

    expect(detectLiquiditySweep(candles)).toBeNull();
  });

  it('honours a custom lookback window', () => {
    const candles: Candle[] = [
      candle(1, 90, 91, 89, 90.5),
      candle(2, 90.5, 91.5, 89.5, 91),
      candle(3, 91, 92, 90, 91.5),
      candle(4, 91.5, 92.5, 90.5, 92),
      candle(5, 92, 93, 91, 92.5),
      candle(6, 100, 102, 99, 101),
      candle(7, 101, 103, 100, 102),
      candle(8, 102, 105, 101, 104),
      candle(9, 105, 110, 100, 100),
    ];

    const setup = detectLiquiditySweep(candles, { lookback: 3 });
    expect(setup).not.toBeNull();
    expect(setup!.signal).toBe('SELL');
  });

  it('returns null with insufficient candles', () => {
    const candles: Candle[] = [
      candle(1, 100, 102, 99, 101),
      candle(2, 101, 103, 100, 102),
      candle(3, 102, 105, 101, 104),
      candle(4, 105, 110, 100, 100),
    ];
    expect(detectLiquiditySweep(candles)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fair Value Gap (Sanpei Age + Tonkachi + FVG)
// ---------------------------------------------------------------------------

describe('detectFairValueGap', () => {
  it('detects a BUY setup after a hammer at a low followed by three rising lines with a gap', () => {
    const candles: Candle[] = [
      candle(1, 110, 111, 106, 107), // ctx: bearish decline
      candle(2, 105, 107, 100, 106), // hammer
      candle(3, 106, 109, 105, 108), // rising line 1
      candle(4, 108, 111, 106, 110), // rising line 2
      candle(5, 110, 115, 111, 114), // rising line 3 — gaps above line 1
    ];

    const setup = detectFairValueGap(candles);
    expect(setup).not.toBeNull();
    expect(setup!.strategy).toBe('FAIR_VALUE_GAP');
    expect(setup!.signal).toBe('BUY');
    expect(setup!.entry).toBe(114);
    expect(setup!.stopLoss).toBeCloseTo(100 * 0.995);
    expect(setup!.takeProfit).toBeCloseTo(114 + (114 - 100 * 0.995) * 2);
    expect(setup!.riskReward).toBe(2);
    expect(setup!.patterns).toEqual(['TONKACHI', 'SANPEI_AGE', 'FVG']);
  });

  it('detects a SELL setup after a shooting star at a high followed by three declining lines with a gap', () => {
    const candles: Candle[] = [
      candle(1, 100, 106, 100, 105), // ctx: bullish rise
      candle(2, 107, 112, 105, 106), // shooting star
      candle(3, 106, 107, 103, 104), // declining line 1
      candle(4, 104, 105, 101, 102), // declining line 2
      candle(5, 102, 102.5, 97, 98), // declining line 3 — gaps below line 1
    ];

    const setup = detectFairValueGap(candles);
    expect(setup).not.toBeNull();
    expect(setup!.signal).toBe('SELL');
    expect(setup!.entry).toBe(98);
    expect(setup!.stopLoss).toBeCloseTo(112 * 1.005);
    expect(setup!.takeProfit).toBeCloseTo(98 - (112 * 1.005 - 98) * 2);
  });

  it('returns null when the advance leaves no fair value gap', () => {
    const candles: Candle[] = [
      candle(1, 110, 111, 106, 107),
      candle(2, 105, 107, 100, 106), // hammer
      candle(3, 106, 109, 105, 108),
      candle(4, 108, 111, 106, 110),
      candle(5, 110.5, 112, 108.5, 111), // rising but low 108.5 < line1 high 109
    ];

    expect(detectFairValueGap(candles)).toBeNull();
  });

  it('returns null when the reversal candle is not a hammer', () => {
    const candles: Candle[] = [
      candle(1, 110, 111, 106, 107),
      candle(2, 100, 106, 96, 105), // long body — not a hammer
      candle(3, 106, 109, 105, 108),
      candle(4, 108, 111, 106, 110),
      candle(5, 110, 115, 111, 114),
    ];

    expect(detectFairValueGap(candles)).toBeNull();
  });

  it('returns null with insufficient candles', () => {
    const candles: Candle[] = [candle(1, 100, 101, 99, 100), candle(2, 99, 100, 98, 99)];
    expect(detectFairValueGap(candles)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Type-level contract
// ---------------------------------------------------------------------------

describe('strategy return type', () => {
  it('always yields a fully populated TradingSetup when non-null', () => {
    const candles: Candle[] = [
      candle(1, 110, 111, 106, 107),
      candle(2, 105, 107, 100, 106),
      candle(3, 106, 109, 105, 108),
      candle(4, 108, 111, 106, 110),
      candle(5, 110, 115, 111, 114),
    ];

    const setup: TradingSetup | null = detectFairValueGap(candles);
    expect(setup).not.toBeNull();
    expect(setup!.entry).toBeGreaterThan(0);
    expect(setup!.stopLoss).toBeLessThan(setup!.entry);
    expect(setup!.takeProfit).toBeGreaterThan(setup!.entry);
    expect(setup!.confidence).toBeGreaterThan(0);
    expect(setup!.patterns.length).toBeGreaterThan(0);
  });
});
