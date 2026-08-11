/**
 * Japanese Candlestick Pattern Recognition Engine
 *
 * Ported from `CandlestickPatternEngine.ts` (zip) to strict TypeScript.
 * Fixed: RSI /0 bug (→ indicators.ts), ATR missing-candle guard,
 * Sakata Five tightened (rising highs → peak → decline → bullish close),
 * all array access uses bounds-checked `at()` to satisfy `noUncheckedIndexedAccess`.
 *
 * Phase 1 covers the 7 pattern detectors. The two Smart-Money strategies
 * (`detectLiquiditySweepStrategy` / `detectFairValueGapStrategy`) will be
 * ported as standalone pure-function modules in Phase 2.
 */

import { calculateRSI } from './indicators';
import type { Candle, MarketContext, Momentum, PatternSignal, Trend } from './types';
import {
  at,
  getBodyRange,
  getBodySize,
  getLowerWick,
  getUpperWick,
  isBearish,
  isBullish,
} from './utils';

const MIN_SIGNAL_CONFIDENCE = 0.6;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class CandlestickPatternEngine {
  private candles: Candle[] = [];

  constructor(candles: readonly Candle[] = []) {
    this.setCandles(candles);
  }

  // ------------------------------------------------------------------
  // Data management
  // ------------------------------------------------------------------

  /** Replace all candles (sorted ascending by timestamp). */
  setCandles(candles: readonly Candle[]): void {
    this.candles = [...candles].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Insert or update a single candle, maintaining timestamp order. */
  addCandle(candle: Candle): void {
    const existingIndex = this.candles.findIndex((c) => c.timestamp === candle.timestamp);
    if (existingIndex >= 0) {
      this.candles[existingIndex] = candle;
    } else {
      this.candles.push(candle);
    }
    this.candles.sort((a, b) => a.timestamp - b.timestamp);
  }

  // ------------------------------------------------------------------
  // Pattern detectors (7 patterns)
  // ------------------------------------------------------------------

  /**
   * **MARUBOZU** — "bald / shaved" candle: strong conviction, no hesitation.
   * Wicks must each be < 10 % of the body.
   */
  detectMarubozu(): PatternSignal | null {
    if (this.candles.length === 0) return null;
    const candle = at(this.candles, this.candles.length - 1);
    const bodySize = getBodySize(candle);
    if (bodySize === 0) return null;

    const upperWick = getUpperWick(candle);
    const lowerWick = getLowerWick(candle);

    if (upperWick < bodySize * 0.1 && lowerWick < bodySize * 0.1) {
      const bull = isBullish(candle);
      return {
        pattern: 'MARUBOZU',
        type: 'REVERSAL',
        signal: bull ? 'BUY' : 'SELL',
        confidence: 0.75,
        entry: candle.close,
        stopLoss: bull ? candle.low * 0.99 : candle.high * 1.01,
        takeProfit: bull ? candle.high * 1.02 : candle.low * 0.98,
        description: `Strong ${bull ? 'bullish' : 'bearish'} conviction — no hesitation`,
        timestamp: candle.timestamp,
      };
    }

    return null;
  }

  /**
   * **TONKACHI** (hammer) — long lower wick, small body, bullish close,
   * following a bearish candle. Classic bottom reversal.
   */
  detectTonkachi(): PatternSignal | null {
    if (this.candles.length < 2) return null;

    const current = at(this.candles, this.candles.length - 1);
    const prev = at(this.candles, this.candles.length - 2);
    const bodySize = getBodySize(current);
    const lowerWick = getLowerWick(current);

    if (lowerWick > bodySize * 2 && isBullish(current) && prev.close < prev.open) {
      return {
        pattern: 'TONKACHI',
        type: 'REVERSAL',
        signal: 'BUY',
        confidence: 0.8,
        entry: current.close,
        stopLoss: current.low * 0.995,
        takeProfit: current.high * 1.02,
        description: 'Hammer reversal at bottom — strong rejection of sellers',
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * **NAGAREBOSHI** (shooting star) — long upper wick, small body,
   * bearish close, following a bullish candle. Classic top reversal.
   */
  detectNagareboshi(): PatternSignal | null {
    if (this.candles.length < 2) return null;

    const current = at(this.candles, this.candles.length - 1);
    const prev = at(this.candles, this.candles.length - 2);
    const bodySize = getBodySize(current);
    const upperWick = getUpperWick(current);

    if (upperWick > bodySize * 2 && isBearish(current) && prev.close > prev.open) {
      return {
        pattern: 'NAGAREBOSHI',
        type: 'REVERSAL',
        signal: 'SELL',
        confidence: 0.8,
        entry: current.close,
        stopLoss: current.high * 1.005,
        takeProfit: current.low * 0.98,
        description: 'Shooting star reversal at top — strong rejection of buyers',
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * **TSUTSUMI** (engulfing) — current body completely engulfs the previous.
   * Bullish engulfing → BUY; bearish engulfing → SELL.
   */
  detectTsutsumi(): PatternSignal | null {
    if (this.candles.length < 2) return null;

    const current = at(this.candles, this.candles.length - 1);
    const prev = at(this.candles, this.candles.length - 2);

    const currHigh = Math.max(current.open, current.close);
    const currLow = Math.min(current.open, current.close);
    const prevHigh = Math.max(prev.open, prev.close);
    const prevLow = Math.min(prev.open, prev.close);

    const currBodySize = getBodySize(current);
    const prevBodySize = getBodySize(prev);

    const bearishEngulf =
      currHigh > prevHigh && currLow < prevLow && currBodySize > prevBodySize && isBearish(current);

    const bullishEngulf =
      currHigh > prevHigh && currLow < prevLow && currBodySize > prevBodySize && isBullish(current);

    if (!bearishEngulf && !bullishEngulf) return null;

    return {
      pattern: 'TSUTSUMI',
      type: 'REVERSAL',
      signal: bearishEngulf ? 'SELL' : 'BUY',
      confidence: 0.8,
      entry: current.close,
      stopLoss: bearishEngulf ? current.high * 1.01 : current.low * 0.99,
      takeProfit: bearishEngulf ? prevLow * 0.98 : prevHigh * 1.02,
      description: `Engulfing ${bearishEngulf ? 'bearish' : 'bullish'} — momentum reversal`,
      timestamp: current.timestamp,
    };
  }

  /**
   * **HARAMI** — current body sits entirely inside previous body.
   * Continuation / consolidation pattern → NEUTRAL; no trade without
   * confirmation.
   */
  detectHarami(): PatternSignal | null {
    if (this.candles.length < 2) return null;

    const current = at(this.candles, this.candles.length - 1);
    const prev = at(this.candles, this.candles.length - 2);

    const prevHigh = Math.max(prev.open, prev.close);
    const prevLow = Math.min(prev.open, prev.close);
    const currHigh = Math.max(current.open, current.close);
    const currLow = Math.min(current.open, current.close);

    if (currHigh < prevHigh && currLow > prevLow) {
      const bull = isBullish(prev);
      return {
        pattern: 'HARAMI',
        type: 'CONTINUATION',
        signal: 'NEUTRAL',
        confidence: 0.6,
        description: `Harami consolidation — ${bull ? 'bullish' : 'bearish'} trend likely to continue`,
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * **DOJI** — body < 10 % of total range (indecision).
   * Signal derived from RSI context: overbought → SELL, oversold → BUY.
   */
  detectDoji(): PatternSignal | null {
    if (this.candles.length === 0) return null;
    const current = at(this.candles, this.candles.length - 1);
    const bodySize = getBodySize(current);
    const totalRange = getBodyRange(current);

    if (totalRange === 0 || bodySize >= totalRange * 0.1) return null;

    const rsi = calculateRSI(this.candles);
    const signal = rsi > 70 ? 'SELL' : rsi < 30 ? 'BUY' : 'NEUTRAL';

    return {
      pattern: 'DOJI',
      type: 'INDECISION',
      signal,
      confidence: 0.5,
      description: 'Doji indecision — watch next candle for direction',
      timestamp: current.timestamp,
    };
  }

  /**
   * **SAKATA FIVE METHOD** — classical 5-candle bottom reversal after a
   * two-candle rise and a subsequent decline.
   *
   * Fixed vs the zip source: the rule set has been tightened to a
   * coherent structure (see comments below) and the fifth candle is now
   * required to close bullish rather than merely above its low.
   *
   * Rule set:
   * 1. Candles 1→2→3 make *rising highs* (the third is the peak).
   * 2. Candle 3→4→4→5 show *declining highs* (rolling over) and
   *    *declining lows* (confirmed pullback).
   * 3. Candle 5 closes **bullish** (close > open) — the reversal.
   */
  detectSakataFive(): PatternSignal | null {
    if (this.candles.length < 5) return null;

    const last5 = this.candles.slice(-5);

    // Destructure via at() to satisfy noUncheckedIndexedAccess.
    const firstHigh = at(last5, 0).high;
    const secondHigh = at(last5, 1).high;
    const peakHigh = at(last5, 2).high;
    const fourthHigh = at(last5, 3).high;
    const fifthHigh = at(last5, 4).high;

    const peakLow = at(last5, 2).low;
    const fourthLow = at(last5, 3).low;
    const fifthLow = at(last5, 4).low;

    const fifthCandle = at(last5, 4);
    const fifthClose = fifthCandle.close;
    const fifthOpen = fifthCandle.open;

    // Rising phase: highs[0] < highs[1] < highs[2]
    const rising = firstHigh < secondHigh && secondHigh < peakHigh;
    // Peak then decline: highs[2] > highs[3] > highs[4]
    const highsDecline = peakHigh > fourthHigh && fourthHigh > fifthHigh;
    // Low-side pullback: lows[2] > lows[3] > lows[4]
    const lowsDecline = peakLow > fourthLow && fourthLow > fifthLow;
    // Bullish reversal confirmation on candle 5
    const bullishClose = fifthClose > fifthOpen;

    if (rising && highsDecline && lowsDecline && bullishClose) {
      return {
        pattern: 'SAKATA_FIVE',
        type: 'REVERSAL',
        signal: 'BUY',
        confidence: 0.85,
        entry: fifthClose,
        stopLoss: fifthLow * 0.995,
        takeProfit: peakHigh * 1.02,
        description: 'Sakata Five Method — classical 5-candle reversal after double-top-like peak',
        timestamp: fifthCandle.timestamp,
      };
    }

    return null;
  }

  // ------------------------------------------------------------------
  // Aggregate analysis
  // ------------------------------------------------------------------

  /** Run all 7 detectors; return signals above `MIN_SIGNAL_CONFIDENCE`. */
  analyzeAllPatterns(): PatternSignal[] {
    const signals: PatternSignal[] = [];

    const patterns: Array<PatternSignal | null> = [
      this.detectMarubozu(),
      this.detectTonkachi(),
      this.detectNagareboshi(),
      this.detectTsutsumi(),
      this.detectHarami(),
      this.detectDoji(),
      this.detectSakataFive(),
    ];

    for (const signal of patterns) {
      if (signal !== null && signal.confidence > MIN_SIGNAL_CONFIDENCE) {
        signals.push(signal);
      }
    }

    return signals;
  }

  // ------------------------------------------------------------------
  // Market context
  // ------------------------------------------------------------------

  /**
   * Derive a high-level market snapshot from the trailing 20 candles.
   * Returns a safe default when there is insufficient data.
   */
  getMarketContext(): MarketContext {
    if (this.candles.length < 20) {
      return {
        trend: 'SIDEWAYS',
        momentum: 'NEUTRAL',
        support: 0,
        resistance: 0,
        rsi: 50,
      };
    }

    const last20 = this.candles.slice(-20);
    const first = at(last20, 0);
    const last = at(last20, last20.length - 1);

    const highs = last20.map((c) => c.high);
    const lows = last20.map((c) => c.low);

    // Trend: compare first and last close, normalised by the total range.
    const range = Math.max(...highs) - Math.min(...lows);
    const closeChange = last.close - first.close;
    const trend: Trend =
      range === 0
        ? 'SIDEWAYS'
        : closeChange > range * 0.1
          ? 'UPTREND'
          : closeChange < -range * 0.1
            ? 'DOWNTREND'
            : 'SIDEWAYS';

    // Momentum: RSI bucketed into five levels.
    const rsi = calculateRSI(this.candles);
    let momentum: Momentum;
    if (rsi >= 70) momentum = 'STRONG_UP';
    else if (rsi > 55) momentum = 'UP';
    else if (rsi <= 30) momentum = 'STRONG_DOWN';
    else if (rsi < 45) momentum = 'DOWN';
    else momentum = 'NEUTRAL';

    return {
      trend,
      momentum,
      support: Math.min(...lows),
      resistance: Math.max(...highs),
      rsi,
    };
  }
}
