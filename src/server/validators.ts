import { z } from 'zod';
import { TIMEFRAMES } from '@/lib/constants';

/**
 * API input validation — every Route Handler validates query params and request
 * bodies through these schemas *before* touching Prisma. Colocated in `src/server`
 * so the validation that guards DB access lives next to it.
 *
 * Query params arrive as strings from `URLSearchParams`, so numeric fields use
 * `z.coerce` to parse them. Request bodies are already JSON and use plain
 * `z.number()`. All defaults mirror the consumer defaults (see `screener.ts`
 * and `PLAN.md §4`).
 */

const symbolSchema = z.string().trim().min(1, 'symbol is required');

// ---------------------------------------------------------------------------
// GET /api/candles — paginated OHLCV
// ---------------------------------------------------------------------------

export const candleQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: z.enum(TIMEFRAMES).default('1d'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// GET /api/patterns — engine signals for the trailing window
// ---------------------------------------------------------------------------

export const patternQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: z.enum(TIMEFRAMES).default('1d'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// GET /api/setup — smart-money strategy setups for a symbol
// ---------------------------------------------------------------------------

export const setupQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: z.enum(TIMEFRAMES).default('1d'),
});

// ---------------------------------------------------------------------------
// GET /api/screen — rank the active universe
// ---------------------------------------------------------------------------

export const screenQuerySchema = z.object({
  timeframe: z.enum(TIMEFRAMES).default('1d'),
  topN: z.coerce.number().int().min(1).max(100).default(25),
  minScore: z.coerce.number().min(0).max(100).default(60),
  orbPeriod: z.coerce.number().int().min(2).max(50).default(5),
  volumeLookback: z.coerce.number().int().min(2).max(100).default(20),
  universe: z
    .enum(['ALL', 'NSE500', 'NIFTY50', 'NIFTY_NEXT50', 'SECTOR', 'WATCHLIST'])
    .default('ALL'),
  sector: z.string().optional(),
  minPrice: z.coerce.number().min(1).max(10000).default(50),
  maxPrice: z.coerce.number().min(1).max(10000).default(5000),
  minVolumeRatio: z.coerce.number().min(0.1).max(10).default(1.5),
  minRsi: z.coerce.number().min(0).max(100).default(30),
  maxRsi: z.coerce.number().min(0).max(100).default(70),
  patterns: z.string().optional(), // comma-separated
  strategies: z.string().optional(), // comma-separated
});

// ---------------------------------------------------------------------------
// /api/trades — list (GET) and create (POST)
// ---------------------------------------------------------------------------

export const tradeQuerySchema = z.object({
  symbol: symbolSchema.optional(),
  status: z.enum(['OPEN', 'CLOSED', 'STOPPED']).default('OPEN'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const tradeCreateSchema = z.object({
  symbol: symbolSchema,
  position: z.enum(['LONG', 'SHORT']),
  entry: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  quantity: z.number().int().positive(),
  pattern: z.string().trim().min(1, 'pattern is required'),
  strategy: z.string().trim().min(1, 'strategy is required'),
  notes: z.string().optional(),
  /**
   * Account equity used to enforce the 1% risk cap and 2% daily-loss halt.
   * Required by the Phase 6 risk engine.
   */
  accountEquity: z.number().positive(),
});

// ---------------------------------------------------------------------------
// /api/trades/:id — update (PATCH) and close (PATCH with exitPrice)
// ---------------------------------------------------------------------------

export const tradeUpdateSchema = z
  .object({
    stopLoss: z.number().positive().optional(),
    takeProfit: z.number().positive().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.stopLoss !== undefined || v.takeProfit !== undefined || v.notes !== undefined, {
    message: 'at least one of stopLoss, takeProfit, notes is required',
  });

export const tradeCloseSchema = z.object({
  exitPrice: z.number().positive(),
  status: z.enum(['CLOSED', 'STOPPED']).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CandleQuery = z.infer<typeof candleQuerySchema>;
export type PatternQuery = z.infer<typeof patternQuerySchema>;
export type SetupQuery = z.infer<typeof setupQuerySchema>;
export type ScreenQuery = z.infer<typeof screenQuerySchema>;
export type TradeQuery = z.infer<typeof tradeQuerySchema>;
export type TradeCreate = z.infer<typeof tradeCreateSchema>;
export type TradeUpdate = z.infer<typeof tradeUpdateSchema>;
export type TradeClose = z.infer<typeof tradeCloseSchema>;

// ---------------------------------------------------------------------------
// GET /api/score-history — historical score snapshots
// ---------------------------------------------------------------------------

export const scoreHistoryQuerySchema = z.object({
  symbol: symbolSchema,
  timeframe: z.enum(TIMEFRAMES).default('5m'),
  hours: z.coerce.number().int().min(1).max(168).default(24), // up to 1 week
});

export type ScoreHistoryQuery = z.infer<typeof scoreHistoryQuerySchema>;

// ---------------------------------------------------------------------------
// GET /api/signal-history — historical pattern/strategy signals
// ---------------------------------------------------------------------------

export const signalHistoryQuerySchema = z.object({
  timeframe: z.enum(TIMEFRAMES).default('5m'),
  hours: z.coerce.number().int().min(1).max(168).default(24), // up to 1 week
  symbol: symbolSchema.optional(),
  signal: z.enum(['BUY', 'SELL', 'NEUTRAL']).optional(),
  pattern: symbolSchema.optional(),
  strategy: symbolSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type SignalHistoryQuery = z.infer<typeof signalHistoryQuerySchema>;
