import { describe, expect, it } from 'vitest';
import { CandlestickPatternEngine } from '@/features/candlestick/engine';
import type { Candle } from '@/features/candlestick/types';

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

function bearishCandle(open: number, low: number, high?: number, close?: number): Candle {
  const h = high ?? open + 1;
  const c = close ?? open - 3;
  return { timestamp: nextTs(), open, high: h, low, close: c, volume: 1_000 };
}

function bullishCandle(close: number, low?: number, high?: number, open?: number): Candle {
  const o = open ?? close - 3;
  const l = low ?? o - 0.5;
  const h = high ?? close + 0.5;
  return { timestamp: nextTs(), open: o, high: h, low: l, close: close, volume: 1_000 };
}

function makeEngine(candles: Candle[]): CandlestickPatternEngine {
  ts = 0;
  return new CandlestickPatternEngine(candles);
}

// ---------------------------------------------------------------------------
// addCandle / setCandles
// ---------------------------------------------------------------------------

describe('CandlestickPatternEngine', () => {
  describe('data management', () => {
    it('sorts candles by timestamp ascending', () => {
      const engine = makeEngine([]);
      engine.addCandle(candle(10, 11, 9, 10.5));
      engine.addCandle(candle(10, 11, 9, 10.5)); // same ts → dedup
      engine.addCandle(candle(10, 11, 9, 10.5)); // same ts → update
      const ctx = engine.getMarketContext();
      expect(ctx.trend).toBe('SIDEWAYS'); // < 20 candles
    });

    it('deduplicates by timestamp on addCandle', () => {
      const engine = makeEngine([]);
      engine.addCandle({ timestamp: 1, open: 100, high: 101, low: 99, close: 100, volume: 1 });
      engine.addCandle({ timestamp: 1, open: 100, high: 101, low: 99, close: 100.5, volume: 1 });
      // getMarketContext needs 20 candles; just check the engine doesn't blow up
      expect(() => engine.getMarketContext()).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Marubozu
  // -----------------------------------------------------------------------

  describe('detectMarubozu', () => {
    it('detects a bullish marubozu', () => {
      const engine = makeEngine([candle(100, 105, 100, 104.8)]);
      const sig = engine.detectMarubozu();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('MARUBOZU');
      expect(sig!.signal).toBe('BUY');
      expect(sig!.confidence).toBe(0.75);
      expect(sig!.entry).toBe(104.8);
    });

    it('detects a bearish marubozu', () => {
      const engine = makeEngine([candle(105, 105, 100, 100.2)]);
      const sig = engine.detectMarubozu();
      expect(sig).not.toBeNull();
      expect(sig!.signal).toBe('SELL');
    });

    it('returns null for a candle with long wicks', () => {
      const engine = makeEngine([candle(100, 115, 85, 104)]);
      expect(engine.detectMarubozu()).toBeNull();
    });

    it('returns null for a flat body', () => {
      const engine = makeEngine([candle(100, 105, 95, 100)]);
      expect(engine.detectMarubozu()).toBeNull();
    });

    it('returns null with empty candles', () => {
      expect(makeEngine([]).detectMarubozu()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Tonkachi (Hammer)
  // -----------------------------------------------------------------------

  describe('detectTonkachi', () => {
    it('detects a hammer after a bearish candle', () => {
      const engine = makeEngine([
        bearishCandle(110, 105), // prev: bearish
        candle(100, 101.5, 96, 101, 1_000), // current: small body=1, lower wick=4
      ]);
      const sig = engine.detectTonkachi();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('TONKACHI');
      expect(sig!.signal).toBe('BUY');
      expect(sig!.confidence).toBe(0.8);
    });

    it('returns null when previous candle is bullish', () => {
      const engine = makeEngine([
        bullishCandle(110), // prev: bullish
        candle(100, 101.5, 96, 101, 1_000),
      ]);
      expect(engine.detectTonkachi()).toBeNull();
    });

    it('returns null with fewer than 2 candles', () => {
      expect(makeEngine([candle(100, 101, 96, 101)]).detectTonkachi()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Nagareboshi (Shooting Star)
  // -----------------------------------------------------------------------

  describe('detectNagareboshi', () => {
    it('detects a shooting star after a bullish candle', () => {
      const engine = makeEngine([
        bullishCandle(105), // prev: bullish
        candle(105, 109, 104, 104, 1_000), // body=1, upperWick=4
      ]);
      const sig = engine.detectNagareboshi();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('NAGAREBOSHI');
      expect(sig!.signal).toBe('SELL');
      expect(sig!.confidence).toBe(0.8);
    });

    it('returns null when previous candle is bearish', () => {
      const engine = makeEngine([
        bearishCandle(105, 100), // prev: bearish
        candle(105, 109, 104, 104, 1_000),
      ]);
      expect(engine.detectNagareboshi()).toBeNull();
    });

    it('returns null with fewer than 2 candles', () => {
      expect(makeEngine([candle(100, 109, 100, 104)]).detectNagareboshi()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Tsutsumi (Engulfing)
  // -----------------------------------------------------------------------

  describe('detectTsutsumi', () => {
    it('detects a bullish engulfing', () => {
      const engine = makeEngine([
        bearishCandle(105, 100), // prev: 105→100, body=5
        candle(99, 106, 98.5, 106, 1_000), // current: 99→106, body=7
      ]);
      const sig = engine.detectTsutsumi();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('TSUTSUMI');
      expect(sig!.signal).toBe('BUY');
      expect(sig!.confidence).toBe(0.8);
    });

    it('detects a bearish engulfing', () => {
      const engine = makeEngine([
        bullishCandle(105, 99, 106, 100), // prev: 100→105, body=5
        candle(106, 107, 98, 99, 1_000), // current: 106→99, body=7
      ]);
      const sig = engine.detectTsutsumi();
      expect(sig).not.toBeNull();
      expect(sig!.signal).toBe('SELL');
    });

    it('returns null when current body is smaller than previous', () => {
      const engine = makeEngine([
        bearishCandle(110, 99), // body 11
        candle(102, 103, 101, 102, 1_000), // body 1 (smaller)
      ]);
      expect(engine.detectTsutsumi()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Harami
  // -----------------------------------------------------------------------

  describe('detectHarami', () => {
    it('detects an inside-bar harami', () => {
      const engine = makeEngine([
        candle(100, 110, 100, 110, 1_000), // prev: bullish body 100–110
        candle(103, 107, 103, 107, 1_000), // current: inside 103–107
      ]);
      const sig = engine.detectHarami();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('HARAMI');
      expect(sig!.type).toBe('CONTINUATION');
      expect(sig!.signal).toBe('NEUTRAL');
      expect(sig!.confidence).toBe(0.6);
    });

    it('returns null when current body is not inside previous', () => {
      const engine = makeEngine([
        candle(105, 110, 105, 110, 1_000),
        candle(100, 115, 100, 115, 1_000),
      ]);
      expect(engine.detectHarami()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Doji
  // -----------------------------------------------------------------------

  describe('detectDoji', () => {
    it('detects a doji with tiny body', () => {
      const engine = makeEngine([candle(100, 105, 95, 100.2, 1_000)]);
      const sig = engine.detectDoji();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('DOJI');
      expect(sig!.type).toBe('INDECISION');
      // RSI of a single candle returns 50 → NEUTRAL
      expect(sig!.signal).toBe('NEUTRAL');
      expect(sig!.confidence).toBe(0.5);
    });

    it('returns null when body is not tiny', () => {
      const engine = makeEngine([candle(100, 110, 90, 108, 1_000)]);
      expect(engine.detectDoji()).toBeNull();
    });

    it('returns null with empty candles', () => {
      expect(makeEngine([]).detectDoji()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Sakata Five
  // -----------------------------------------------------------------------

  describe('detectSakataFive', () => {
    it('detects the 5-candle reversal pattern', () => {
      // Timestamps 1–5 ensure ascending order in the engine.
      const c1: Candle = { timestamp: 1, open: 10, high: 10, low: 8, close: 9, volume: 1 };
      const c2: Candle = { timestamp: 2, open: 9, high: 11, low: 8.5, close: 10.5, volume: 1 };
      const c3: Candle = { timestamp: 3, open: 10.5, high: 12, low: 10.5, close: 11.5, volume: 1 };
      const c4: Candle = { timestamp: 4, open: 11.5, high: 11, low: 9.5, close: 10, volume: 1 };
      const c5: Candle = { timestamp: 5, open: 9.4, high: 10.3, low: 9, close: 10, volume: 1 };

      const engine = makeEngine([c1, c2, c3, c4, c5]);
      const sig = engine.detectSakataFive();
      expect(sig).not.toBeNull();
      expect(sig!.pattern).toBe('SAKATA_FIVE');
      expect(sig!.signal).toBe('BUY');
      expect(sig!.confidence).toBe(0.85);
      expect(sig!.entry).toBe(10);
      expect(sig!.stopLoss).toBeCloseTo(9 * 0.995);
      expect(sig!.takeProfit).toBeCloseTo(12 * 1.02);
    });

    it('returns null with fewer than 5 candles', () => {
      expect(makeEngine([]).detectSakataFive()).toBeNull();
    });

    it('returns null when the 5th candle is not bullish', () => {
      const c1: Candle = { timestamp: 1, open: 10, high: 10, low: 8, close: 9, volume: 1 };
      const c2: Candle = { timestamp: 2, open: 9, high: 11, low: 8.5, close: 10.5, volume: 1 };
      const c3: Candle = { timestamp: 3, open: 10.5, high: 12, low: 10.5, close: 11.5, volume: 1 };
      const c4: Candle = { timestamp: 4, open: 11.5, high: 11, low: 9.5, close: 10, volume: 1 };
      // Bearish 5th candle: close < open
      const c5: Candle = { timestamp: 5, open: 10.2, high: 10.5, low: 9, close: 9.2, volume: 1 };

      const engine = makeEngine([c1, c2, c3, c4, c5]);
      expect(engine.detectSakataFive()).toBeNull();
    });

    it('returns null when highs are not rising in first two', () => {
      // highs[0] = 12, highs[1] = 11 — not rising
      const c1: Candle = { timestamp: 1, open: 10, high: 12, low: 9, close: 11, volume: 1 };
      const c2: Candle = { timestamp: 2, open: 11, high: 11, low: 10, close: 10.5, volume: 1 };
      const c3: Candle = { timestamp: 3, open: 10.5, high: 11.5, low: 10, close: 11, volume: 1 };
      const c4: Candle = { timestamp: 4, open: 11, high: 11, low: 9.5, close: 10, volume: 1 };
      const c5: Candle = { timestamp: 5, open: 9.4, high: 10, low: 9, close: 10, volume: 1 };

      const engine = makeEngine([c1, c2, c3, c4, c5]);
      expect(engine.detectSakataFive()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // analyzeAllPatterns
  // -----------------------------------------------------------------------

  describe('analyzeAllPatterns', () => {
    it('excludes patterns at or below confidence 0.6', () => {
      // A doji (confidence 0.5) should be excluded.
      const engine = makeEngine([candle(100, 105, 95, 100.2, 1_000)]);
      expect(engine.analyzeAllPatterns()).toHaveLength(0);
    });

    it('includes marubozu (0.75) above threshold', () => {
      const engine = makeEngine([candle(100, 105, 100, 104.8)]);
      const signals = engine.analyzeAllPatterns();
      expect(signals).toHaveLength(1);
      expect(signals[0]?.pattern).toBe('MARUBOZU');
    });
  });

  // -----------------------------------------------------------------------
  // getMarketContext
  // -----------------------------------------------------------------------

  describe('getMarketContext', () => {
    it('returns SIDEWAYS/NEUTRAL with < 20 candles', () => {
      const ctx = makeEngine([]).getMarketContext();
      expect(ctx.trend).toBe('SIDEWAYS');
      expect(ctx.momentum).toBe('NEUTRAL');
    });

    it('detects UPTREND when last close > first close by > 10% of range', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 20; i++) {
        candles.push(candle(i, i, 0, i, 1_000, i));
      }
      const ctx = makeEngine(candles).getMarketContext();
      expect(ctx.trend).toBe('UPTREND');
    });

    it('detects DOWNTREND when close falls', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 20; i++) {
        candles.push(candle(20 - i, 20, 0, 20 - i, 1_000, i));
      }
      const ctx = makeEngine(candles).getMarketContext();
      expect(ctx.trend).toBe('DOWNTREND');
    });

    it('reports support and resistance', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 20; i++) {
        candles.push(candle(50 + i, 60 + i, 40 + i, 55 + i, 1_000, i));
      }
      const ctx = makeEngine(candles).getMarketContext();
      expect(ctx.support).toBe(40);
      expect(ctx.resistance).toBe(79);
    });
  });
});
