/**
 * **Liquidity Sweep strategy** (SanSen + Tsutsumi + Liquidity Sweep).
 *
 * A Smart-Money reversal that combines three Sakata concepts:
 *
 * - **SanSen** ("three lines") — an established short-term trend: three
 *   consecutive bullish candles with advancing closes (or three bearish with
 *   declining closes) immediately before the signal candle.
 * - **Liquidity sweep** — price spikes *through* a recent swing extreme (a
 *   resting pool of stop orders) and closes back beyond it: a false breakout
 *   / stop-hunt.
 * - **Tsutsumi** (engulfing) — the sweep candle is an engulfing reversal of
 *   the last trend candle, confirming the reversal of direction.
 *
 * The result is a reversal `TradingSetup`: SELL after sweeping liquidity above
 * a high in an uptrend, BUY after sweeping liquidity below a low in a
 * downtrend. Stop is placed beyond the swept extreme (the wick), take-profit
 * is a fixed risk-reward multiple.
 *
 * Pure function over candles — no database or engine dependency. Phase 4 wires
 * it to the `/api/setup` route handler.
 */

import type { Candle, TradingSetup } from '@/features/candlestick/types';
import { at, getBodySize } from '@/features/candlestick/utils';
import type { LiquiditySweepOptions } from './types';

const DEFAULT_LOOKBACK = 8;
const DEFAULT_RISK_REWARD = 2;
/** Distance beyond the swept extreme that the stop-loss sits at. */
const STOP_BUFFER = 0.005;

/** Bearish engulfing: current body fully engulfs the previous and closes down. */
function isBearishEngulfing(prev: Candle, current: Candle): boolean {
  const prevHigh = Math.max(prev.open, prev.close);
  const prevLow = Math.min(prev.open, prev.close);
  const currHigh = Math.max(current.open, current.close);
  const currLow = Math.min(current.open, current.close);
  return (
    currHigh > prevHigh &&
    currLow < prevLow &&
    getBodySize(current) > getBodySize(prev) &&
    current.close < current.open
  );
}

/** Bullish engulfing: current body fully engulfs the previous and closes up. */
function isBullishEngulfing(prev: Candle, current: Candle): boolean {
  const prevHigh = Math.max(prev.open, prev.close);
  const prevLow = Math.min(prev.open, prev.close);
  const currHigh = Math.max(current.open, current.close);
  const currLow = Math.min(current.open, current.close);
  return (
    currHigh > prevHigh &&
    currLow < prevLow &&
    getBodySize(current) > getBodySize(prev) &&
    current.close > current.open
  );
}

/**
 * Detect a liquidity-sweep reversal setup on the trailing candles.
 *
 * @param candles  Candles sorted ascending by timestamp (only the last
 *                 `lookback + 1` are examined).
 * @param options  Optional `lookback` and `riskReward` overrides.
 * @returns        A `TradingSetup` when all conditions align, otherwise `null`.
 */
export function detectLiquiditySweep(
  candles: readonly Candle[],
  options: LiquiditySweepOptions = {}
): TradingSetup | null {
  const lookback = options.lookback ?? DEFAULT_LOOKBACK;
  const riskReward = options.riskReward ?? DEFAULT_RISK_REWARD;

  // Need the signal candle plus `lookback` context candles, and the three
  // SanSen candles (indices n-4..n-2) must exist.
  const minCandles = Math.max(5, lookback + 1);
  if (candles.length < minCandles) return null;

  const last = at(candles, candles.length - 1);
  const s1 = at(candles, candles.length - 4);
  const s2 = at(candles, candles.length - 3);
  const s3 = at(candles, candles.length - 2);

  // SanSen: three consecutive candles in one direction with advancing closes.
  const sanSenRising =
    s1.close > s1.open &&
    s2.close > s2.open &&
    s3.close > s3.open &&
    s1.close < s2.close &&
    s2.close < s3.close;
  const sanSenFalling =
    s1.close < s1.open &&
    s2.close < s2.open &&
    s3.close < s3.open &&
    s1.close > s2.close &&
    s2.close > s3.close;

  // Recent swing extreme over the lookback window (excluding the signal candle).
  const windowStart = candles.length - (lookback + 1);
  const priorWindow = candles.slice(windowStart, candles.length - 1);
  const recentHigh = Math.max(...priorWindow.map((c) => c.high));
  const recentLow = Math.min(...priorWindow.map((c) => c.low));

  // SELL — sweep above a high, rejection close, bearish engulfing confirmation.
  if (
    sanSenRising &&
    last.high > recentHigh &&
    last.close < recentHigh &&
    isBearishEngulfing(s3, last)
  ) {
    const stopLoss = last.high * (1 + STOP_BUFFER);
    const takeProfit = last.close - (stopLoss - last.close) * riskReward;
    return {
      strategy: 'LIQUIDITY_SWEEP',
      signal: 'SELL',
      entry: last.close,
      stopLoss,
      takeProfit,
      riskReward,
      confidence: 0.8,
      patterns: ['SANSEN', 'LIQUIDITY_SWEEP', 'TSUTSUMI'],
    };
  }

  // BUY — sweep below a low, rejection close, bullish engulfing confirmation.
  if (
    sanSenFalling &&
    last.low < recentLow &&
    last.close > recentLow &&
    isBullishEngulfing(s3, last)
  ) {
    const stopLoss = last.low * (1 - STOP_BUFFER);
    const takeProfit = last.close + (last.close - stopLoss) * riskReward;
    return {
      strategy: 'LIQUIDITY_SWEEP',
      signal: 'BUY',
      entry: last.close,
      stopLoss,
      takeProfit,
      riskReward,
      confidence: 0.8,
      patterns: ['SANSEN', 'LIQUIDITY_SWEEP', 'TSUTSUMI'],
    };
  }

  return null;
}
