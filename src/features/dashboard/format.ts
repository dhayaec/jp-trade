/**
 * Pure display helpers for the dashboard UI.
 *
 * Kept dependency-free (no React) so every function is trivially unit-testable
 * and reusable from both Server and Client components. `candlesToChartData` and
 * `candlesToVolumeData` convert feature-layer `Candle`s into the wire shape that
 * `lightweight-charts` v5 expects (time in **seconds**, not milliseconds).
 */

import type { Candle } from '@/features/candlestick/types';
import type { UTCTimestamp } from 'lightweight-charts';

const priceFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timestampFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Format a price with Indian digit grouping and two decimals, e.g. `3,450.25`. */
export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

/** Format a 0–1 confidence/ratio as a whole percent, e.g. `0.78` → `78%`. */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Format a volume ratio with a × suffix, e.g. `1.5×`. */
export function formatRatio(value: number): string {
  return `${value.toFixed(1)}×`;
}

/** Format a millisecond timestamp as a medium date + short time. */
export function formatTimestamp(ms: number): string {
  return timestampFormatter.format(new Date(ms));
}

// ---------------------------------------------------------------------------
// lightweight-charts data conversion
// ---------------------------------------------------------------------------

export interface ChartCandle {
  /** Unix seconds — lightweight-charts rejects millisecond precision. */
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartVolumeBar {
  time: UTCTimestamp;
  value: number;
  color: string;
}

/** Up-candle / down-candle volume colors (muted, to sit behind price action). */
const VOLUME_UP = 'rgba(34, 197, 94, 0.4)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.4)';

/** Feature `Candle`s → candlestick series data, newest candle last. */
export function candlesToChartData(candles: readonly Candle[]): ChartCandle[] {
  return candles.map((c) => ({
    time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

/** Feature `Candle`s → volume histogram data, colored by candle direction. */
export function candlesToVolumeData(candles: readonly Candle[]): ChartVolumeBar[] {
  return candles.map((c) => ({
    time: Math.floor(c.timestamp / 1000) as UTCTimestamp,
    value: c.volume,
    color: c.close >= c.open ? VOLUME_UP : VOLUME_DOWN,
  }));
}
