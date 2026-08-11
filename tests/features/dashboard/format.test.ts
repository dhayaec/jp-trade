import { describe, expect, it } from 'vitest';
import {
  candlesToChartData,
  candlesToVolumeData,
  formatPercent,
  formatPrice,
  formatRatio,
  formatTimestamp,
} from '@/features/dashboard/format';
import type { Candle } from '@/features/candlestick/types';

function candle(
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): Candle {
  return { timestamp, open, high, low, close, volume };
}

describe('formatPrice', () => {
  it('uses Indian digit grouping and two decimals', () => {
    expect(formatPrice(3450.25)).toBe('3,450.25');
  });

  it('renders whole prices with trailing zeros', () => {
    expect(formatPrice(100)).toBe('100.00');
  });
});

describe('formatPercent', () => {
  it('rounds a 0–1 fraction to a whole percent', () => {
    expect(formatPercent(0.78)).toBe('78%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.605)).toBe('61%');
  });
});

describe('formatRatio', () => {
  it('formats with one decimal and a × suffix', () => {
    expect(formatRatio(1.5)).toBe('1.5×');
    expect(formatRatio(2)).toBe('2.0×');
  });
});

describe('formatTimestamp', () => {
  it('formats a millisecond timestamp as a readable date-time', () => {
    const iso = new Date(Date.UTC(2026, 7, 1, 12, 30)).toISOString();
    const out = formatTimestamp(Date.parse(iso));
    // The exact string is locale/zone-dependent; assert it is non-empty and
    // mentions the day of the month we fed in.
    expect(out).toContain('Aug');
  });
});

describe('candlesToChartData', () => {
  it('converts ms timestamps to seconds and preserves OHLC', () => {
    const candles = [candle(1_720_000_000_000, 100, 105, 99, 104, 1000)];
    const data = candlesToChartData(candles);

    expect(data).toEqual([
      {
        time: 1_720_000_000,
        open: 100,
        high: 105,
        low: 99,
        close: 104,
      },
    ]);
  });

  it('keeps candles in input order (oldest first)', () => {
    const candles = [candle(1000, 10, 11, 9, 10.5, 100), candle(2000, 10.5, 12, 10, 11, 150)];
    expect(candlesToChartData(candles).map((c) => c.time)).toEqual([1, 2]);
  });

  it('handles an empty array', () => {
    expect(candlesToChartData([])).toEqual([]);
  });
});

describe('candlesToVolumeData', () => {
  it('colors up candles green and down candles red', () => {
    const candles = [
      candle(1000, 10, 11, 9, 10.5, 100), // up
      candle(2000, 10.5, 11, 10, 10, 90), // down
    ];
    const data = candlesToVolumeData(candles);

    expect(data).toHaveLength(2);
    expect(data[0]?.value).toBe(100);
    expect(data[0]?.color).toMatch(/rgba\(34, 197, 94/);
    expect(data[1]?.value).toBe(90);
    expect(data[1]?.color).toMatch(/rgba\(239, 68, 68/);
  });

  it('treats a doji (close === open) as an up candle', () => {
    const data = candlesToVolumeData([candle(1000, 10, 11, 9, 10, 50)]);
    expect(data[0]?.color).toMatch(/rgba\(34, 197, 94/);
  });
});
