/**
 * **Stock Screener** — pure-function scoring and ranking of a symbol universe.
 *
 * Phase 3 of the implementation plan. The screener has **no database access**:
 * callers pass candles in (`screenStocks(candlesBySymbol, opts)`) and receive a
 * ranked list of `ScreeningCandidate`s. Phase 4 wires this to `GET /api/screen`
 * behind Zod validation.
 *
 * Two entry points:
 * - `scoreCandidate(volumeRatio, rsi, patternCount, isORB)` — a 0–100 composite
 *   of the four raw signals that drive an intraday setup.
 * - `screenStocks(candlesBySymbol, opts)` — derive those signals per symbol and
 *   return the top-ranked candidates.
 */

import { CandlestickPatternEngine } from '@/features/candlestick/engine';
import { calculateRSI } from '@/features/candlestick/indicators';
import type { Candle } from '@/features/candlestick/types';
import { at } from '@/features/candlestick/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreeningOptions {
  /** Maximum number of candidates to return, ranked by score descending. Defaults to `10`. */
  topN?: number;
  /** Minimum score (0–100) a candidate must reach to be included. Defaults to `60`. */
  minScore?: number;
  /** Number of candles that form the opening range for ORB detection. Defaults to `5`. */
  orbPeriod?: number;
  /** Number of trailing candles used for the average-volume baseline. Defaults to `20`. */
  volumeLookback?: number;
}

/** Per-component score breakdown (each 0–100 before weighting). */
export interface ScoreBreakdown {
  volume: number;
  rsi: number;
  pattern: number;
  orb: number;
}

export interface ScreeningCandidate {
  symbol: string;
  /** 0–100 composite score; higher = more actionable setup. */
  score: number;
  /** Per-component scores (0–100 each, pre-weight) for explainability. */
  breakdown?: ScoreBreakdown;
  /** Last candle volume ÷ average volume over the lookback (excluding the last candle). */
  volumeRatio: number;
  /** RSI over the trailing window (see `calculateRSI`). */
  rsi: number;
  /** Number of confident pattern signals detected by the engine. */
  patternCount: number;
  /** Whether the latest close breaks the opening range (bullish or bearish). */
  isORB: boolean;
  /** Names of the detected patterns. */
  patterns: string[];
  /** Latest close price. */
  lastClose: number;
}

// ---------------------------------------------------------------------------
// Scoring weights and caps
// ---------------------------------------------------------------------------

/** Volume ratio at or above this is treated as maximum liquidity interest. */
const VOLUME_RATIO_CAP = 3;
/** Pattern count at or above this is treated as full confluence. */
const PATTERN_COUNT_CAP = 3;
/** RSI below this is oversold; above is overbought — both score zero. */
const RSI_FLOOR = 30;
const RSI_CEILING = 80;
/** RSI sweet-spot band: momentum is strongest for an entry here. */
const RSI_SWEET_LOW = 50;
const RSI_SWEET_HIGH = 65;

// Component weights — sum to 1.0.
const WEIGHT_VOLUME = 0.3;
const WEIGHT_RSI = 0.3;
const WEIGHT_PATTERN = 0.2;
const WEIGHT_ORB = 0.2;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Clamp a component score into [0, 100]. */
function clampComponent(value: number): number {
  return Math.max(0, Math.min(value, 100));
}

/**
 * RSI sweet-spot score: full marks inside 50–65, linear ramps to zero at the
 * oversold floor (30) and overbought ceiling (80). Chasing an overbought
 * breakout scores zero; a dead market scores zero.
 */
function rsiScore(rsi: number): number {
  if (rsi < RSI_FLOOR || rsi > RSI_CEILING) return 0;
  if (rsi <= RSI_SWEET_LOW) return ((rsi - RSI_FLOOR) / (RSI_SWEET_LOW - RSI_FLOOR)) * 100;
  if (rsi <= RSI_SWEET_HIGH) return 100;
  return ((RSI_CEILING - rsi) / (RSI_CEILING - RSI_SWEET_HIGH)) * 100;
}

/**
 * Score a single candidate on a 0–100 scale from its raw signals.
 *
 * Components (each 0–100, weighted):
 * - volume ratio (30%) — unusual volume vs baseline, capped at `VOLUME_RATIO_CAP`
 * - RSI sweet spot (30%) — 50–65 ideal, decaying to 0 outside 30–80
 * - pattern confluence (20%) — detected patterns, capped at `PATTERN_COUNT_CAP`
 * - opening-range breakout (20%) — full marks when `isORB` is true
 *
 * @returns `{ total, breakdown }` where `total` is the integer composite in
 *          [0, 100] and `breakdown` holds each pre-weight component score.
 */
export function scoreCandidate(
  volumeRatio: number,
  rsi: number,
  patternCount: number,
  isORB: boolean
): { total: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    volume: clampComponent((volumeRatio / VOLUME_RATIO_CAP) * 100),
    rsi: rsiScore(rsi),
    pattern: clampComponent((patternCount / PATTERN_COUNT_CAP) * 100),
    orb: isORB ? 100 : 0,
  };

  const raw =
    breakdown.volume * WEIGHT_VOLUME +
    breakdown.rsi * WEIGHT_RSI +
    breakdown.pattern * WEIGHT_PATTERN +
    breakdown.orb * WEIGHT_ORB;

  return { total: clampComponent(Math.round(raw)), breakdown };
}

// ---------------------------------------------------------------------------
// Signal derivation
// ---------------------------------------------------------------------------

/**
 * Last candle volume ÷ average volume of the preceding `volumeLookback`
 * candles. The current candle is excluded from the baseline so a single surge
 * reads as a genuine ratio. Returns 0 when there is no baseline.
 */
function computeVolumeRatio(candles: readonly Candle[], volumeLookback: number): number {
  if (candles.length < 2) return 0;
  const last = at(candles, candles.length - 1);
  const baseline = candles.slice(-(volumeLookback + 1), -1);
  if (baseline.length === 0) return 0;

  const average = baseline.reduce((sum, c) => sum + c.volume, 0) / baseline.length;
  return average === 0 ? 0 : last.volume / average;
}

/**
 * Opening-range breakout: the latest close pierces the high or low of the
 * opening `orbPeriod` candles (the range formed in the first minutes after
 * open). Breakout direction is not scored here — either side indicates the
 * liquidity/momentum the screener is looking for.
 */
function detectORB(candles: readonly Candle[], orbPeriod: number): boolean {
  if (candles.length <= orbPeriod) return false;
  const range = candles.slice(0, orbPeriod);
  const orHigh = Math.max(...range.map((c) => c.high));
  const orLow = Math.min(...range.map((c) => c.low));
  const last = at(candles, candles.length - 1);
  return last.close > orHigh || last.close < orLow;
}

// ---------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------

const DEFAULT_TOP_N = 10;
const DEFAULT_MIN_SCORE = 60;
const DEFAULT_ORB_PERIOD = 5;
const DEFAULT_VOLUME_LOOKBACK = 20;

/**
 * Screen a symbol universe and return the top-ranked candidates.
 *
 * Per symbol: volume ratio and RSI from the trailing window, pattern count via
 * `CandlestickPatternEngine`, ORB from the opening range. Symbols with too few
 * candles to derive all signals are skipped, not scored.
 *
 * @param candlesBySymbol  Map of symbol → candles sorted ascending by timestamp.
 * @param options          `topN`, `minScore`, `orbPeriod`, `volumeLookback` overrides.
 * @returns                Candidates ranked by score descending (ties broken
 *                         alphabetically), filtered by `minScore`, limited to
 *                         `topN`.
 */
export function screenStocks(
  candlesBySymbol: Readonly<Record<string, readonly Candle[]>>,
  options: ScreeningOptions = {}
): ScreeningCandidate[] {
  const topN = options.topN ?? DEFAULT_TOP_N;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const orbPeriod = options.orbPeriod ?? DEFAULT_ORB_PERIOD;
  const volumeLookback = options.volumeLookback ?? DEFAULT_VOLUME_LOOKBACK;

  // Enough data for ORB (orbPeriod + 1), a volume baseline (volumeLookback + 1)
  // and RSI (period + 1).
  const minCandles = Math.max(orbPeriod + 1, volumeLookback + 1, 14 + 1);

  const candidates: ScreeningCandidate[] = [];

  for (const [symbol, candles] of Object.entries(candlesBySymbol)) {
    if (candles.length < minCandles) continue;

    const patterns = new CandlestickPatternEngine(candles).analyzeAllPatterns();
    const volumeRatio = computeVolumeRatio(candles, volumeLookback);
    const rsi = calculateRSI(candles);
    const isORB = detectORB(candles, orbPeriod);
    const { total, breakdown } = scoreCandidate(volumeRatio, rsi, patterns.length, isORB);

    if (total < minScore) continue;

    candidates.push({
      symbol,
      score: total,
      breakdown,
      volumeRatio,
      rsi,
      patternCount: patterns.length,
      isORB,
      patterns: patterns.map((signal) => signal.pattern),
      lastClose: at(candles, candles.length - 1).close,
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, topN);
}
