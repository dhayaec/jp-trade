import { describe, expect, it } from 'vitest';
import type { Candle } from '@/features/candlestick/types';
import { screenStocks, scoreCandidate } from '@/features/screener/screener';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function candle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1_000
): Candle {
  return { timestamp, open, high, low, close, volume };
}

/**
 * Opening range (ts 1–5, OR high = 104, OR low = 98) followed by a choppy
 * mid-session (ts 6–24) whose RSI lands in the 55–65 sweet spot. Callers append
 * a final candle at ts 25.
 */
function baseSeries(): Candle[] {
  const candles: Candle[] = [
    candle(1, 99, 100, 98, 99),
    candle(2, 99, 101, 99, 100),
    candle(3, 100, 102, 99, 101),
    candle(4, 101, 103, 100, 102),
    candle(5, 102, 104, 101, 103),
  ];

  let close = 103;
  for (let i = 0; i < 19; i++) {
    const up = i % 2 === 0;
    const open = close;
    const nextClose = up ? close + 0.8 : close - 0.6;
    candles.push(
      candle(
        6 + i,
        open,
        Math.max(open, nextClose) + 0.3,
        Math.min(open, nextClose) - 0.3,
        nextClose
      )
    );
    close = nextClose;
  }
  return candles;
}

/** Bullish opening-range breakout on a volume surge. */
function aaaSeries(): Candle[] {
  return [...baseSeries(), candle(25, 104, 107, 103, 106, 6_000)];
}

/** Inside-range close on baseline volume. */
function bbbSeries(): Candle[] {
  return [...baseSeries(), candle(25, 103, 105, 102, 104, 1_000)];
}

// ---------------------------------------------------------------------------
// scoreCandidate
// ---------------------------------------------------------------------------

describe('scoreCandidate', () => {
  it('scores 100 when every component is maximised', () => {
    expect(scoreCandidate(3, 55, 3, true)).toBe(100);
    expect(scoreCandidate(10, 55, 10, true)).toBe(100);
  });

  it('scores the weighted sum for a neutral profile', () => {
    // No volume, RSI 50 (full sweet-spot points), no patterns, no ORB.
    expect(scoreCandidate(0, 50, 0, false)).toBe(30);
  });

  it('awards the full ORB weight when the breakout is present', () => {
    expect(scoreCandidate(0, 50, 0, false)).toBe(30);
    expect(scoreCandidate(0, 50, 0, true)).toBe(50);
  });

  it('caps volume ratio at the cap', () => {
    expect(scoreCandidate(3, 55, 3, true)).toBe(100);
    expect(scoreCandidate(6, 55, 3, true)).toBe(100);
  });

  it('caps pattern count at the cap', () => {
    expect(scoreCandidate(3, 55, 3, true)).toBe(100);
    expect(scoreCandidate(3, 55, 9, true)).toBe(100);
  });

  it('scores the RSI sweet spot boundaries and ramps', () => {
    // Plateau: 50 and 65 both earn full RSI points.
    expect(scoreCandidate(0, 50, 0, false)).toBe(30);
    expect(scoreCandidate(0, 65, 0, false)).toBe(30);
    // Floor and ceiling earn zero RSI points.
    expect(scoreCandidate(0, 30, 0, false)).toBe(0);
    expect(scoreCandidate(0, 80, 0, false)).toBe(0);
    // Ramps: half RSI points at the midpoint of each ramp.
    expect(scoreCandidate(0, 40, 0, false)).toBe(15);
    expect(scoreCandidate(0, 72.5, 0, false)).toBe(15);
    // Out of range is zero RSI points too.
    expect(scoreCandidate(0, 20, 0, false)).toBe(0);
    expect(scoreCandidate(0, 90, 0, false)).toBe(0);
  });

  it('clamps negative volume ratios to zero contribution', () => {
    expect(scoreCandidate(-5, 30, 0, false)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// screenStocks
// ---------------------------------------------------------------------------

describe('screenStocks', () => {
  it('returns an empty list for an empty universe', () => {
    expect(screenStocks({})).toEqual([]);
  });

  it('skips symbols with too few candles to score', () => {
    const short = [candle(1, 100, 101, 99, 100), candle(2, 100, 102, 99, 101)];
    expect(screenStocks({ SHORT: short })).toEqual([]);
  });

  it('ranks by score and drops candidates below the default minScore', () => {
    const result = screenStocks({ AAA: aaaSeries(), BBB: bbbSeries() });
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAA');
    expect(result[0].score).toBeGreaterThanOrEqual(60);
  });

  it('derives volume ratio, ORB, patterns, and last close per symbol', () => {
    const [aaa] = screenStocks({ AAA: aaaSeries() }, { minScore: 0 });
    expect(aaa.volumeRatio).toBeCloseTo(6);
    expect(aaa.isORB).toBe(true);
    expect(aaa.patternCount).toBeGreaterThanOrEqual(1);
    expect(aaa.patterns).toContain('TSUTSUMI');
    expect(aaa.lastClose).toBe(106);

    const [bbb] = screenStocks({ BBB: bbbSeries() }, { minScore: 0 });
    expect(bbb.volumeRatio).toBeCloseTo(1);
    expect(bbb.isORB).toBe(false);
    expect(bbb.patternCount).toBe(0);
  });

  it('returns the top N candidates', () => {
    const result = screenStocks(
      { BBB: bbbSeries(), AAA: aaaSeries(), CCC: bbbSeries() },
      { minScore: 0, topN: 2 }
    );
    expect(result.map((c) => c.symbol)).toEqual(['AAA', 'BBB']);
  });

  it('breaks equal-score ties alphabetically', () => {
    const result = screenStocks({ ZZZ: bbbSeries(), AAA: bbbSeries() }, { minScore: 0 });
    expect(result.map((c) => c.symbol)).toEqual(['AAA', 'ZZZ']);
  });

  it('applies a minScore override', () => {
    expect(screenStocks({ AAA: aaaSeries() }, { minScore: 100 })).toEqual([]);
    expect(screenStocks({ AAA: aaaSeries() }, { minScore: 0 })).toHaveLength(1);
  });
});
