import { getEnv } from '@/lib/env';

/**
 * Trading-domain constants: NSE stock universe, supported timeframes, screener
 * thresholds, and risk-management defaults. See PLAN.md §2 (data model) and the
 * per-phase tables for where each value is consumed.
 */

// ---------------------------------------------------------------------------
// Timeframes
// ---------------------------------------------------------------------------

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

// ---------------------------------------------------------------------------
// NSE stock universe (screener / watchlist seed)
// ---------------------------------------------------------------------------

export interface StockDefinition {
  symbol: string;
  name: string;
  sector: string;
}

/** Default liquid large-cap universe used to seed `StockSymbol` and run scans. */
export const NSE_UNIVERSE: readonly StockDefinition[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Banking' },
  { symbol: 'INFY', name: 'Infosys', sector: 'IT' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom' },
  { symbol: 'ITC', name: 'ITC Limited', sector: 'FMCG' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Banking' },
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Infrastructure' },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Banking' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Auto' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', sector: 'Pharma' },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer' },
  { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'IT' },
  { symbol: 'WIPRO', name: 'Wipro', sector: 'IT' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Consumer' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'Auto' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Financial Services' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'Conglomerate' },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy' },
];

export const SUPPORTED_EXCHANGES = ['NSE'] as const;

// ---------------------------------------------------------------------------
// Screener thresholds (from CandlestickPatternEngine.ts / plan)
// ---------------------------------------------------------------------------

export const SCREENER_DEFAULTS = {
  /** Volume ≥ 1.5× the rolling average counts as an anomaly. */
  volumeMultiplier: 1.5,
  /** RSI band considered "neutral" (overbought/oversold excluded). */
  rsi: { min: 30, max: 70 },
  /** Minimum candles required to compute reliable indicators. */
  minCandles: 50,
  /** Signals below this confidence are discarded by the scanner. */
  minConfidence: 0.6,
  /** Number of top-scored results surfaced by default. */
  topN: 10,
} as const;

// ---------------------------------------------------------------------------
// Risk-management defaults (Phase 6)
// ---------------------------------------------------------------------------

export const RISK_DEFAULTS = {
  /** Max 1% of capital risked per trade. */
  maxRiskPerTrade: 0.01,
  /** Max 3 active trades per day. */
  maxTradesPerDay: 3,
  /** Max 2% daily loss — halt trading for the day. */
  maxDailyLoss: 0.02,
  /** Minimum reward:risk ratio for an acceptable setup. */
  minRiskReward: 2,
} as const;

// ---------------------------------------------------------------------------
// Market hours (IST) — sourced from validated env
// ---------------------------------------------------------------------------

export interface MarketHours {
  open: string;
  close: string;
}

/** NSE session window in IST, as `HH:MM` 24h strings from env. */
export function getMarketHours(): MarketHours {
  const env = getEnv();
  return { open: env.MARKET_OPEN, close: env.MARKET_CLOSE };
}
