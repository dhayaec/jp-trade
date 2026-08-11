import type { Candle } from './types';
import { at } from './utils';

// ---------------------------------------------------------------------------
// RSI (Relative Strength Index)
// ---------------------------------------------------------------------------

/**
 * Simplified Wilder-style RSI over the trailing `period` changes.
 *
 * **Bugs fixed vs the zip source:**
 * - `avgLoss === 0` now returns 100 exactly (was `avgGain / 0.0001` ≈ 100
 *   but not exactly, and NaN if both zero).
 * - All-flat series (gains = losses = 0) now returns a neutral 50.
 *
 * @returns 0–100 or 50 when there is insufficient data.
 */
export function calculateRSI(candles: readonly Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  const start = candles.length - period;

  for (let i = start; i < candles.length; i++) {
    const change = at(candles, i).close - at(candles, i - 1).close;
    if (change > 0) gains += change;
    else losses += -change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  // All-flat → neutral.
  if (avgGain === 0 && avgLoss === 0) return 50;
  // No losses → maximum strength.
  if (avgLoss === 0) return 100;
  // No gains → no strength.
  if (avgGain === 0) return 0;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ---------------------------------------------------------------------------
// ATR (Average True Range)
// ---------------------------------------------------------------------------

/**
 * Average True Range over the trailing `period` candles.
 *
 * **Fixed vs zip source:** now requires `period + 1` candles (the first
 * iteration needs a valid previous close, which the original overlooked).
 *
 * @returns 0 when there is insufficient data.
 */
export function calculateATR(candles: readonly Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;

  let trSum = 0;
  const start = candles.length - period;

  for (let i = start; i < candles.length; i++) {
    const current = at(candles, i);
    const previousClose = at(candles, i - 1).close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previousClose),
      Math.abs(current.low - previousClose)
    );
    trSum += tr;
  }

  return trSum / period;
}
