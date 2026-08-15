/**
 * Typed client for the Phase 4 API layer.
 *
 * All dashboard data flows through these helpers, which live on the **browser**
 * side (each page shell is a Server Component, but the interactive panels fetch
 * on mount). Every route returns `{ data: T[] }` on success and `{ error }` on
 * failure; this module normalizes both into `T[]` or a thrown `Error`.
 */

import type { Candle, PatternSignal, TradingSetup } from '@/features/candlestick/types';
import {
  calculateConfidence,
  type ConfidenceBreakdown,
  type ScreeningCandidate,
} from '@/features/screener/screener';
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
  universe?: string;
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  minVolumeRatio?: number;
  minRsi?: number;
  maxRsi?: number;
  patterns?: string;
  strategies?: string;
  minRiskReward?: number;
}

export function fetchScreen(params: ScreenParams): Promise<ScreeningCandidate[]> {
  const {
    timeframe,
    topN,
    minScore,
    orbPeriod,
    volumeLookback,
    universe,
    sector,
    minPrice,
    maxPrice,
    minVolumeRatio,
    minRsi,
    maxRsi,
    patterns,
    strategies,
    minRiskReward,
  } = params;
  // Fresh literal so it's assignable to `Record<string, string | number | undefined>`.
  return getData<ScreeningCandidate>('/api/screen', {
    timeframe,
    topN,
    minScore,
    orbPeriod,
    volumeLookback,
    universe,
    sector,
    minPrice,
    maxPrice,
    minVolumeRatio,
    minRsi,
    maxRsi,
    patterns,
    strategies,
    minRiskReward,
  });
}

export type TradeStatus = TradeResponse['status'];

export function fetchTrades(status: TradeStatus): Promise<TradeResponse[]>;
export function fetchTrades(
  status: TradeStatus,
  options: { all?: boolean; limit?: number }
): Promise<TradeResponse[]>;
export function fetchTrades(
  status: TradeStatus,
  options: { all?: boolean; limit?: number } = {}
): Promise<TradeResponse[]> {
  const { all, limit } = options;
  if (all) {
    // Fetch every status and de-duplicate by id (a trade has exactly one
    // status, so the union is already unique; the merge keeps the helper
    // usable for analytics without a dedicated "all" endpoint).
    return Promise.all(
      (['OPEN', 'CLOSED', 'STOPPED'] as const).map((s) =>
        getData<TradeResponse>('/api/trades', { status: s, limit: limit ?? 500 })
      )
    ).then((lists) => {
      const seen = new Set<string>();
      const merged: TradeResponse[] = [];
      for (const list of lists) {
        for (const t of list) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            merged.push(t);
          }
        }
      }
      return merged;
    });
  }
  return getData<TradeResponse>('/api/trades', { status, limit });
}

// ---------------------------------------------------------------------------
// Signals (aggregate)
// ---------------------------------------------------------------------------

export interface AggregateSignal {
  symbol: string;
  pattern: string;
  type: 'REVERSAL' | 'CONTINUATION' | 'INDECISION';
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  description: string;
  timestamp: number;
}

export interface AggregateSetup {
  symbol: string;
  strategy: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  patterns: string[];
}

export interface SignalsResponse {
  patterns: AggregateSignal[];
  setups: AggregateSetup[];
}

/** GET /api/signals — all current symbol pattern/strategy signals. */
export async function fetchSignals(timeframe: Timeframe): Promise<SignalsResponse> {
  const res = await fetch(`/api/signals${toQuery({ timeframe })}`, { cache: 'no-store' });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { data?: SignalsResponse; error?: string };
  if (body.error) throw new Error(body.error);
  return body.data ?? { patterns: [], setups: [] };
}

// ---------------------------------------------------------------------------
// Score history
// ---------------------------------------------------------------------------

export interface ScoreHistoryPoint {
  timestamp: string;
  score: number;
  confidence: number;
  breakdown?: ScoreBreakdown | null;
  changeReason?: string | null;
  scoreDelta?: number | null;
}

export function fetchScoreHistory(
  symbol: string,
  timeframe: Timeframe,
  hours = 24
): Promise<ScoreHistoryPoint[]> {
  return getData<ScoreHistoryPoint>('/api/score-history', { symbol, timeframe, hours });
}

// ---------------------------------------------------------------------------
// Backtest
// ---------------------------------------------------------------------------

/**
 * Client-facing backtest metrics.
 *
 * Mirrors `src/features/backtest/metrics.ts` `BacktestMetrics` with two additions:
 * - `maxDrawdownPctDisplay`: `maxDrawdownPct * 100` for UI display (the canonical
 *   field is a fraction, e.g. 0.15 = 15%).
 * - `avgRiskReward`: derived as `averageWin / averageLoss` (0 when no losses).
 * - `totalReturnPct`: derived as `(totalPnl / initialCapital) * 100`.
 */
export interface BacktestMetrics {
  totalTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  /** Fraction of peak equity (e.g. 0.15 = 15%). */
  maxDrawdownPct: number;
  /** `maxDrawdownPct * 100` — ready for UI display. */
  maxDrawdownPctDisplay: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  totalPnl: number;
  /** `averageWin / averageLoss` (0 when no losses). */
  avgRiskReward: number;
  /** `(totalPnl / initialCapital) * 100`. */
  totalReturnPct: number;
}

export interface BacktestStrategyResult {
  strategy: string;
  metrics: BacktestMetrics;
  tradeCount: number;
  trades?: unknown[];
}

export async function fetchBacktest(
  timeframe: Timeframe,
  limit = 2000,
  riskReward = 2
): Promise<Array<BacktestMetrics & { strategy: string }>> {
  const res = await fetch(`/api/backtest${toQuery({ timeframe, limit, riskReward })}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { data?: BacktestStrategyResult[]; error?: string };
  if (body.error) throw new Error(body.error);
  return (body.data ?? []).map((r) => ({
    ...r.metrics,
    // Derived fields for UI
    maxDrawdownPctDisplay: r.metrics.maxDrawdownPct * 100,
    avgRiskReward: r.metrics.averageLoss > 0 ? r.metrics.averageWin / r.metrics.averageLoss : 0,
    totalReturnPct: (r.metrics.totalPnl / 100_000) * 100,
    strategy: r.strategy,
  }));
}

// ---------------------------------------------------------------------------
// Signal History
// ---------------------------------------------------------------------------

export interface HistoricalPatternSignal {
  symbol: string;
  pattern: string;
  type: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  confidence: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeframe: string;
  timestamp: number;
  createdAt: string;
}

export interface HistoricalStrategySignal extends TradingSetup {
  symbol: string;
  computedAt: string;
}

export interface SignalHistoryResponse {
  patterns: HistoricalPatternSignal[];
  strategies: HistoricalStrategySignal[];
}

export async function fetchSignalHistory(params: {
  timeframe: Timeframe;
  hours?: number;
  symbol?: string;
  signal?: 'BUY' | 'SELL' | 'NEUTRAL';
  pattern?: string;
  strategy?: string;
  limit?: number;
}): Promise<SignalHistoryResponse> {
  const { timeframe, hours = 24, symbol, signal, pattern, strategy, limit = 100 } = params;
  const res = await fetch(
    `/api/signal-history${toQuery({ timeframe, hours, symbol, signal, pattern, strategy, limit })}`,
    { cache: 'no-store' }
  );
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { data?: SignalHistoryResponse; error?: string };
  if (body.error) throw new Error(body.error);
  return body.data ?? { patterns: [], strategies: [] };
}

// ---------------------------------------------------------------------------
// Detail page helpers
// ---------------------------------------------------------------------------

export interface CandidateDetail {
  symbol: string;
  score: number;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  breakdown: ScoreBreakdown;
  volumeRatio: number;
  rsi: number;
  patternCount: number;
  isORB: boolean;
  patterns: string[];
  lastClose: number;
  candles: Candle[];
  patternSignals: PatternSignal[];
  setups: TradingSetup[];
}

export interface ScoreBreakdown {
  volume: number;
  rsi: number;
  pattern: number;
  orb: number;
}

export async function fetchCandidateDetail(
  symbol: string,
  timeframe: Timeframe
): Promise<CandidateDetail> {
  const [screen, candles, patternSignals, setups] = await Promise.all([
    fetchScreen({ timeframe, topN: 100, minScore: 0 }),
    fetchCandles(symbol, timeframe),
    fetchPatterns(symbol, timeframe),
    fetchSetups(symbol, timeframe),
  ]);

  const candidate = screen.find((c) => c.symbol === symbol);

  if (!candidate) {
    throw new Error(`Candidate ${symbol} not found in screen results`);
  }

  const breakdown = candidate.breakdown ?? {
    volume: 0,
    rsi: 0,
    pattern: 0,
    orb: 0,
  };

  // Recalculate confidence with full pattern/setup data available at detail time
  const confidenceBreakdown = calculateConfidence(
    candidate.volumeRatio,
    candidate.rsi,
    candidate.isORB,
    patternSignals.map((p) => ({ pattern: p.pattern, signal: p.signal })),
    setups.map((s) => ({ strategy: s.strategy, signal: s.signal }))
  );

  return {
    symbol: candidate.symbol,
    score: candidate.score,
    confidence: confidenceBreakdown.overall,
    confidenceBreakdown,
    breakdown,
    volumeRatio: candidate.volumeRatio,
    rsi: candidate.rsi,
    patternCount: candidate.patternCount,
    isORB: candidate.isORB,
    patterns: candidate.patterns,
    lastClose: candidate.lastClose,
    candles,
    patternSignals,
    setups,
  };
}
