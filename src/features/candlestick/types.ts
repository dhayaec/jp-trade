/**
 * Core trading-domain types for the Japanese candlestick pattern engine.
 *
 * These are *feature-layer* types — independent of Prisma and the database
 * schema. `Candle` carries numbers for computation; the DB layer maps
 * `Decimal`/`BigInt` columns to/from these fields in Phase 4.
 */

// ---------------------------------------------------------------------------
// Raw market data
// ---------------------------------------------------------------------------

export interface Candle {
  /** Unix epoch milliseconds — used for ordering, not display. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ---------------------------------------------------------------------------
// Pattern / signal types
// ---------------------------------------------------------------------------

export type Signal = 'BUY' | 'SELL' | 'NEUTRAL';

export type PatternType = 'REVERSAL' | 'CONTINUATION' | 'INDECISION';

export interface PatternSignal {
  pattern: string;
  type: PatternType;
  signal: Signal;
  /** 0.0 – 1.0; signals below 0.6 are filtered by `analyzeAllPatterns`. */
  confidence: number;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  description: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Strategy types (populated in Phase 2)
// ---------------------------------------------------------------------------

export interface TradingSetup {
  strategy: string;
  signal: Signal;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  confidence: number;
  patterns: string[];
}

// ---------------------------------------------------------------------------
// Market context
// ---------------------------------------------------------------------------

export type Trend = 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';

export type Momentum = 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN';

export interface MarketContext {
  trend: Trend;
  momentum: Momentum;
  support: number;
  resistance: number;
  rsi: number;
}
