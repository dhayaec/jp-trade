/**
 * Typed client for the Phase 4 API layer.
 *
 * All dashboard data flows through these helpers, which live on the **browser**
 * side (each page shell is a Server Component, but the interactive panels fetch
 * on mount). Every route returns `{ data: T[] }` on success and `{ error }` on
 * failure; this module normalizes both into `T[]` or a thrown `Error`.
 */

import type { Candle, PatternSignal, TradingSetup } from '@/features/candlestick/types';
import type { ScreeningCandidate } from '@/features/screener/screener';
import type { Timeframe } from '@/lib/constants';
import type { TradeResponse } from '@/server/serializers';

interface ApiResponse<T> {
  data?: T[];
  error?: string;
}

/** Serialize a params record into a query string (`URLSearchParams`). */
function toQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) usp.set(key, String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

/** GET an endpoint and normalize `{ data | error }` to `T[]`. */
async function getData<T>(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<T[]> {
  const res = await fetch(`${path}${toQuery(params)}`, { cache: 'no-store' });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new Error(message);
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (body.error) throw new Error(body.error);
  return body.data ?? [];
}

// ---------------------------------------------------------------------------
// Endpoint helpers
// ---------------------------------------------------------------------------

export const API_LIMIT = 100;

export function fetchCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  return getData<Candle>('/api/candles', { symbol, timeframe, limit: API_LIMIT });
}

export function fetchPatterns(symbol: string, timeframe: Timeframe): Promise<PatternSignal[]> {
  return getData<PatternSignal>('/api/patterns', { symbol, timeframe, limit: API_LIMIT });
}

export function fetchSetups(symbol: string, timeframe: Timeframe): Promise<TradingSetup[]> {
  return getData<TradingSetup>('/api/setup', { symbol, timeframe });
}

export interface ScreenParams {
  timeframe: Timeframe;
  topN?: number;
  minScore?: number;
  orbPeriod?: number;
  volumeLookback?: number;
}

export function fetchScreen(params: ScreenParams): Promise<ScreeningCandidate[]> {
  const { timeframe, topN, minScore, orbPeriod, volumeLookback } = params;
  // Fresh literal so it's assignable to `Record<string, string | number | undefined>`.
  return getData<ScreeningCandidate>('/api/screen', {
    timeframe,
    topN,
    minScore,
    orbPeriod,
    volumeLookback,
  });
}

export type TradeStatus = TradeResponse['status'];

export function fetchTrades(status: TradeStatus): Promise<TradeResponse[]> {
  return getData<TradeResponse>('/api/trades', { status });
}
