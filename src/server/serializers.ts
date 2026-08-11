import type { Candle } from '@/features/candlestick/types';

/**
 * Serialization helpers — Prisma returns `Decimal` and `BigInt` objects that are
 * not JSON-serializable. Every Route Handler converts rows through these before
 * `NextResponse.json`.
 *
 * The field types are deliberately loose (`unknown`) rather than the generated
 * Prisma types so this module stays testable without a generated client and
 * doesn't leak Prisma's `Decimal`/`BigInt` classes into the API contract.
 */

interface DbCandle {
  timestamp: Date;
  open: unknown;
  high: unknown;
  low: unknown;
  close: unknown;
  volume: unknown;
}

/** Convert a Prisma `Candle` row to the feature-layer `Candle` (numbers only). */
export function serializeCandle(c: DbCandle): Candle {
  return {
    timestamp: c.timestamp.getTime(),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume),
  };
}

/** Wire shape of a `Trade` — Decimal/BigInt coerced, timestamps ISO-8601. */
export interface TradeResponse {
  id: string;
  symbol: string;
  position: 'LONG' | 'SHORT';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pattern: string;
  strategy: string;
  status: 'OPEN' | 'CLOSED' | 'STOPPED';
  exitPrice: number | null;
  pnl: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

interface DbTrade {
  id: string;
  symbol: string;
  position: string;
  entry: unknown;
  stopLoss: unknown;
  takeProfit: unknown;
  quantity: number;
  pattern: string;
  strategy: string;
  status: string;
  exitPrice: unknown | null;
  pnl: unknown | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

/** Convert a Prisma `Trade` row to its JSON wire shape. */
export function serializeTrade(t: DbTrade): TradeResponse {
  return {
    id: t.id,
    symbol: t.symbol,
    position: t.position as TradeResponse['position'],
    entry: Number(t.entry),
    stopLoss: Number(t.stopLoss),
    takeProfit: Number(t.takeProfit),
    quantity: t.quantity,
    pattern: t.pattern,
    strategy: t.strategy,
    status: t.status as TradeResponse['status'],
    exitPrice: t.exitPrice == null ? null : Number(t.exitPrice),
    pnl: t.pnl == null ? null : Number(t.pnl),
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    closedAt: t.closedAt ? t.closedAt.toISOString() : null,
  };
}
