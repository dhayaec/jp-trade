import type { Candle } from './types';

// ---------------------------------------------------------------------------
// Bounds-checked array access
// ---------------------------------------------------------------------------

/**
 * Access an index with a bounds check, defeating `noUncheckedIndexedAccess`.
 * In production, the engine always calls this after a length guard, so it
 * never throws — but the guard keeps the type-narrowing honest and the
 * runtime safe against future regressions.
 */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${index} out of bounds for array of length ${items.length}`);
  }
  return item;
}

// ---------------------------------------------------------------------------
// Candle geometry helpers
// ---------------------------------------------------------------------------

/** Absolute difference between open and close. */
export function getBodySize(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

/** Full range: high − low. */
export function getBodyRange(candle: Candle): number {
  return candle.high - candle.low;
}

/** Distance from the top of the body (max(open, close)) to the high. */
export function getUpperWick(candle: Candle): number {
  return candle.high - Math.max(candle.open, candle.close);
}

/** Distance from the bottom of the body (min(open, close)) to the low. */
export function getLowerWick(candle: Candle): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

export function isBullish(candle: Candle): boolean {
  return candle.close > candle.open;
}

export function isBearish(candle: Candle): boolean {
  return candle.close < candle.open;
}
