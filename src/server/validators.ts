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
  topN: z.coerce.number().int().min(1).max(100).default(10),
  minScore: z.coerce.number().min(0).max(100).default(60),
  orbPeriod: z.coerce.number().int().min(2).max(50).default(5),
  volumeLookback: z.coerce.number().int().min(2).max(100).default(20),
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
