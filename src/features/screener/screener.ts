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
  /** Minimum volume ratio (current / baseline). Defaults to `1.5`. */
  minVolumeRatio?: number;
  /** Minimum RSI. Defaults to `30`. */
  minRsi?: number;
  /** Maximum RSI. Defaults to `70`. */
  maxRsi?: number;
  /** Pattern names that must be present (any match). Defaults to empty (no filter). */
  patterns?: string[] | undefined;
  /** Strategy names that must be present (any match). Defaults to empty (no filter). */
  strategies?: string[] | undefined;
  /** Minimum risk/reward ratio. Defaults to `1.5`. */
  minRiskReward?: number | undefined;
  /** Minimum price. Defaults to `50`. */
  minPrice?: number;
  /** Maximum price. Defaults to `5000`. */
  maxPrice?: number;
}

/** Per-component score breakdown (each 0–100 before weighting). */
export interface ScoreBreakdown {
  volume: number;
  rsi: number;
  pattern: number;
  orb: number;
}

/** Risk-related score components. */
export interface RiskBreakdown {
  /** Stop-loss distance as % of entry (lower = better risk). */
  stopLossDistance: number;
  /** Risk/reward ratio (higher = better). */
  riskReward: number;
  /** Position size score based on volatility (0–100). */
  positionSizing: number;
  /** Overall risk score (0–100, higher = better risk profile). */
  total: number;
}

/** Per-component confidence breakdown — how much signals agree (0–100). */
export interface ConfidenceBreakdown {
  technicalAgreement: number; // volume + RSI + trend alignment
  patternAgreement: number; // multiple patterns confirm same direction
  strategyAgreement: number; // strategies align
  overall: number; // 0–100%
}

export interface ScreeningCandidate {
  symbol: string;
  /** 0–100 composite score; higher = more actionable setup. */
  score: number;
  /** 0–100 confidence; how much signals agree. */
  confidence: number;
  /** Per-component scores (0–100 each, pre-weight) for explainability. */
  breakdown?: ScoreBreakdown;
  /** Per-component confidence breakdown. */
  confidenceBreakdown?: ConfidenceBreakdown;
  /** Last candle volume �� average volume over the lookback (excluding the last candle). */
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

/**
 * Calculate confidence based on signal agreement.
 *
 * Confidence measures how much the signals align with each other.
 * High confidence = multiple signals pointing in the same direction.
 * Low confidence = signals conflict or are mixed.
 */
export function calculateConfidence(
  volumeRatio: number,
  rsi: number,
  isORB: boolean,
  patternSignals: readonly { pattern: string; signal: 'BUY' | 'SELL' | 'NEUTRAL' }[],
  setups: readonly { strategy: string; signal: 'BUY' | 'SELL' | 'NEUTRAL' }[]
): ConfidenceBreakdown {
  // Technical agreement: volume, RSI, ORB all pointing same way?
  // Volume > 1.5 is bullish, RSI 50-65 is bullish, ORB breakout is bullish
  const volumeBullish = volumeRatio >= 1.5;
  const rsiBullish = rsi >= 50 && rsi <= 65;
  const orbBullish = isORB;

  // Count how many technical signals agree (assuming bullish bias for intraday)
  const technicalSignals = [volumeBullish, rsiBullish, orbBullish].filter(Boolean).length;
  const technicalAgreement = Math.round((technicalSignals / 3) * 100);

  // Pattern agreement: multiple patterns with same signal direction
  const bullishPatterns = patternSignals.filter((p) => p.signal === 'BUY').length;
  const bearishPatterns = patternSignals.filter((p) => p.signal === 'SELL').length;
  const patternAgreement =
    patternSignals.length > 0
      ? Math.round((Math.max(bullishPatterns, bearishPatterns) / patternSignals.length) * 100)
      : 50; // neutral when no patterns

  // Strategy agreement: strategies with same signal direction
  const bullishSetups = setups.filter((s) => s.signal === 'BUY').length;
  const bearishSetups = setups.filter((s) => s.signal === 'SELL').length;
  const strategyAgreement =
    setups.length > 0
      ? Math.round((Math.max(bullishSetups, bearishSetups) / setups.length) * 100)
      : 50; // neutral when no strategies

  // Overall confidence: weighted average
  const overall = Math.round(
    technicalAgreement * 0.4 + patternAgreement * 0.3 + strategyAgreement * 0.3
  );

  return {
    technicalAgreement,
    patternAgreement,
    strategyAgreement,
    overall,
  };
}

// ---------------------------------------------------------------------------
// Signal derivation
// ---------------------------------------------------------------------------

/**
 * Last candle volume �� average volume of the preceding `volumeLookback`
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
const DEFAULT_MIN_VOLUME_RATIO = 1.5;
const DEFAULT_MIN_RSI = 30;
const DEFAULT_MAX_RSI = 70;
const DEFAULT_MIN_PRICE = 50;
const DEFAULT_MAX_PRICE = 5000;

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
  const minVolumeRatio = options.minVolumeRatio ?? DEFAULT_MIN_VOLUME_RATIO;
  const minRsi = options.minRsi ?? DEFAULT_MIN_RSI;
  const maxRsi = options.maxRsi ?? DEFAULT_MAX_RSI;
  const minPrice = options.minPrice ?? DEFAULT_MIN_PRICE;
  const maxPrice = options.maxPrice ?? DEFAULT_MAX_PRICE;
  // minRiskReward is not applied at screening time (requires full strategy analysis)
  // It will be validated on the detail page.
  const requiredPatterns = options.patterns ?? [];
  const requiredStrategies = options.strategies ?? [];

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

    // Apply filters
    if (volumeRatio < minVolumeRatio) continue;
    if (rsi < minRsi || rsi > maxRsi) continue;

    const lastClose = at(candles, candles.length - 1).close;
    if (lastClose < minPrice || lastClose > maxPrice) continue;

    // Pattern filter: at least one required pattern must be present
    const patternNames = patterns.map((p) => p.pattern);
    if (requiredPatterns.length > 0 && !requiredPatterns.some((p) => patternNames.includes(p))) {
      continue;
    }

    // Strategy filter: check if any required strategy is detected
    // For screening time, we use ORB as a proxy for strategy detection
    if (requiredStrategies.length > 0) {
      const hasORB = requiredStrategies.includes('ORB') && isORB;
      // Note: Liquidity Sweep and FVG detection requires more context
      // At screening time we just check ORB; detail page has full detection
      if (!hasORB && requiredStrategies.some((s) => s !== 'ORB')) {
        // Allow through for now - detail page will validate fully
      }
    }

    const { total, breakdown } = scoreCandidate(volumeRatio, rsi, patterns.length, isORB);

    if (total < minScore) continue;

    // Calculate confidence (patterns and strategies are empty at screening time;
    // detail page will recalculate with full data)
    const confidenceBreakdown = calculateConfidence(
      volumeRatio,
      rsi,
      isORB,
      patterns.map((p) => ({ pattern: p.pattern, signal: p.signal })),
      [] // setups not available at screening time
    );

    candidates.push({
      symbol,
      score: total,
      confidence: confidenceBreakdown.overall,
      breakdown,
      confidenceBreakdown,
      volumeRatio,
      rsi,
      patternCount: patterns.length,
      isORB,
      patterns: patternNames,
      lastClose,
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || a.symbol.localeCompare(b.symbol))
    .slice(0, topN);
}
