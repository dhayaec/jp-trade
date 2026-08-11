/**
 * **Fair Value Gap strategy** (Sanpei Age + Tonkachi + FVG).
 *
 * A Smart-Money reversal that combines a bottom-reversal candle with a
 * one-sided advance leaving an unfilled imbalance:
 *
 * - **Tonkachi** (hammer) / **Nagareboshi** (shooting star) — the reversal
 *   candle at the extreme, printed against the preceding trend.
 * - **Sanpei Age** ("three rising lines") — three consecutive bullish candles
 *   with strictly advancing closes after the reversal. The SELL leg is its
 *   mirror, Sanpei Sage (three declining lines). "Parallel" is interpreted as
 *   a steady, evenly-stepped advance rather than overlapping bodies — the
 *   latter would contradict the gap condition below.
 * - **Fair Value Gap (FVG)** — an imbalance between the first and third
 *   advancing candle: for BUY, the third candle's low sits *above* the first
 *   candle's high (`g1.high < g3.low`), the gap price never traded. Represents
 *   aggressive one-way participation.
 *
 * Stop sits beyond the reversal candle's extreme, take-profit is a fixed
 * risk-reward multiple.
 *
 * Pure function over candles — no database or engine dependency. Phase 4 wires
 * it to the `/api/setup` route handler.
 */

import type { Candle, TradingSetup } from '@/features/candlestick/types';
import { at, getBodySize, getLowerWick, getUpperWick } from '@/features/candlestick/utils';
import type { StrategyOptions } from './types';

const DEFAULT_RISK_REWARD = 2;
/** Distance beyond the reversal extreme that the stop-loss sits at. */
const STOP_BUFFER = 0.005;
/** Number of candles required before the signal: context + reversal + 3 lines. */
const MIN_CANDLES = 5;

/**
 * Detect a fair-value-gap reversal setup on the trailing candles.
 *
 * @param candles  Candles sorted ascending by timestamp (only the last five
 *                 are examined).
 * @param options  Optional `riskReward` override.
 * @returns        A `TradingSetup` when all conditions align, otherwise `null`.
 */
export function detectFairValueGap(
  candles: readonly Candle[],
  options: StrategyOptions = {}
): TradingSetup | null {
  const riskReward = options.riskReward ?? DEFAULT_RISK_REWARD;

  if (candles.length < MIN_CANDLES) return null;

  const ctx = at(candles, candles.length - 5);
  const reversal = at(candles, candles.length - 4);
  const g1 = at(candles, candles.length - 3);
  const g2 = at(candles, candles.length - 2);
  const g3 = at(candles, candles.length - 1);

  // BUY — downtrend → hammer at the low → three rising lines leaving a gap.
  const reversalIsHammer = isHammer(reversal);
  const sanpeiAgeRising =
    g1.close > g1.open &&
    g2.close > g2.open &&
    g3.close > g3.open &&
    g1.close < g2.close &&
    g2.close < g3.close;
  const bullishGap = g1.high < g3.low;

  if (ctx.close < ctx.open && reversalIsHammer && sanpeiAgeRising && bullishGap) {
    const stopLoss = reversal.low * (1 - STOP_BUFFER);
    const takeProfit = g3.close + (g3.close - stopLoss) * riskReward;
    return {
      strategy: 'FAIR_VALUE_GAP',
      signal: 'BUY',
      entry: g3.close,
      stopLoss,
      takeProfit,
      riskReward,
      confidence: 0.8,
      patterns: ['TONKACHI', 'SANPEI_AGE', 'FVG'],
    };
  }

  // SELL — uptrend → shooting star at the high → three declining lines leaving a gap.
  const reversalIsShootingStar = isShootingStar(reversal);
  const sanpeiSageFalling =
    g1.close < g1.open &&
    g2.close < g2.open &&
    g3.close < g3.open &&
    g1.close > g2.close &&
    g2.close > g3.close;
  const bearishGap = g1.low > g3.high;

  if (ctx.close > ctx.open && reversalIsShootingStar && sanpeiSageFalling && bearishGap) {
    const stopLoss = reversal.high * (1 + STOP_BUFFER);
    const takeProfit = g3.close - (stopLoss - g3.close) * riskReward;
    return {
      strategy: 'FAIR_VALUE_GAP',
      signal: 'SELL',
      entry: g3.close,
      stopLoss,
      takeProfit,
      riskReward,
      confidence: 0.8,
      patterns: ['NAGAREBOSHI', 'SANPEI_SAGE', 'FVG'],
    };
  }

  return null;
}

/** Tonkachi (hammer): long lower wick, small body, bullish close. */
function isHammer(candle: Candle): boolean {
  const bodySize = getBodySize(candle);
  return bodySize > 0 && getLowerWick(candle) > bodySize * 2 && candle.close > candle.open;
}

/** Nagareboshi (shooting star): long upper wick, small body, bearish close. */
function isShootingStar(candle: Candle): boolean {
  const bodySize = getBodySize(candle);
  return bodySize > 0 && getUpperWick(candle) > bodySize * 2 && candle.close < candle.open;
}
