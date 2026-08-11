/**
 * **Trade Lifecycle** — open, update, and close trades with the risk engine
 * enforced at the Prisma boundary.
 *
 * Phase 6 of the implementation plan ("server actions"). These are plain async
 * functions, not Next.js `'use server'` exports — this app is API-first
 * (Phase 4/5), so route handlers call them. Every mutation goes through the
 * risk rules in `risk.ts` before touching the database.
 *
 * Error hierarchy (`TradeError` → HTTP status):
 * - `TradeLimitError`      → 409  (risk limit blocked the trade)
 * - `TradeNotFoundError`   → 404  (trade id not in DB)
 * - All other `TradeError` → 400  (bad input: bad stop, over-size, not open)
 */

import type { Prisma, Trade } from '@prisma/client';
import { RISK_DEFAULTS } from '@/lib/constants';
import { getPrisma } from '@/server/db';
import {
  calculatePnl,
  calculatePositionSize,
  canOpenTrade,
  clampTrailingStop,
  isStopOnCorrectSide,
  startOfIstDay,
  type PositionSide,
} from './risk';

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

/** Base class for business-rule failures surfaced as 4xx to API callers. */
export class TradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradeError';
  }
}

/** A risk limit blocks the operation — surfaced as 409 Conflict. */
export class TradeLimitError extends TradeError {
  readonly reason: 'MAX_ACTIVE_TRADES' | 'DAILY_LOSS_LIMIT';

  constructor(reason: 'MAX_ACTIVE_TRADES' | 'DAILY_LOSS_LIMIT') {
    const message =
      reason === 'MAX_ACTIVE_TRADES'
        ? 'Trade limit reached: max active trades for the day'
        : 'Daily loss limit reached: trading halted for the day';
    super(message);
    this.name = 'TradeLimitError';
    this.reason = reason;
  }
}

/** Trade id not found in the database. */
export class TradeNotFoundError extends TradeError {
  constructor(id: string) {
    super(`Trade not found: ${id}`);
    this.name = 'TradeNotFoundError';
  }
}

/** The trade is not in OPEN status (cannot be closed or updated). */
export class TradeNotOpenError extends TradeError {
  constructor(id: string) {
    super(`Trade ${id} is not open`);
    this.name = 'TradeNotOpenError';
  }
}

/** The stop is on the wrong side of entry or another input is invalid. */
export class InvalidStopError extends TradeError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStopError';
  }
}

/** Submitted quantity exceeds the 1% risk cap or no affordable position exists. */
export class PositionSizeError extends TradeError {
  readonly maxQuantity: number;

  constructor(quantity: number, maxQuantity: number) {
    super(
      maxQuantity < 1
        ? 'the stop distance is too wide for a 1% risk on this account (no affordable position)'
        : `quantity ${quantity} exceeds the 1% risk cap of ${maxQuantity} shares`
    );
    this.name = 'PositionSizeError';
    this.maxQuantity = maxQuantity;
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Fields that describe a trade itself (no risk-config fields). */
export interface TradeDraft {
  symbol: string;
  position: PositionSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  pattern: string;
  strategy: string;
  notes?: string;
}

export interface OpenTradeOptions {
  /** Equity used to enforce the 1% risk cap and the daily-loss halt. */
  accountEquity: number;
  riskPerTradePct?: number;
  maxActiveTrades?: number;
  maxDailyLossPct?: number;
  /** Clock override for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface CloseTradeInput {
  /** Price at which the position is exited. */
  exitPrice: number;
  /**
   * How the position ended. Defaults to `CLOSED`; pass `STOPPED` when the
   * stop was hit.
   */
  status?: 'CLOSED' | 'STOPPED';
  /** Clock override for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface UpdateTradeInput {
  /** New stop price. Clamped so the stop never trails past breakeven. */
  stopLoss?: number;
  takeProfit?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Trade lifecycle operations
// ---------------------------------------------------------------------------

/**
 * Open a new trade. Enforces:
 * 1. Hard stop on the correct side of entry (not inverted)
 * 2. Max active trades / daily loss halt (`canOpenTrade`)
 * 3. The submitted quantity does not exceed the 1% risk cap
 *
 * The trade is then persisted via Prisma.
 */
export async function openTrade(input: TradeDraft, options: OpenTradeOptions): Promise<Trade> {
  const prisma = getPrisma();
  const now = options.now ?? new Date();
  const accountEquity = options.accountEquity;
  const riskPerTradePct = options.riskPerTradePct ?? RISK_DEFAULTS.maxRiskPerTrade;
  const maxActiveTrades = options.maxActiveTrades ?? RISK_DEFAULTS.maxTradesPerDay;
  const maxDailyLossPct = options.maxDailyLossPct ?? RISK_DEFAULTS.maxDailyLoss;

  // --- Input validation (before any DB work) ---
  if (accountEquity <= 0) {
    throw new TradeError('accountEquity must be positive');
  }
  if (input.entry <= 0 || input.stopLoss <= 0) {
    throw new TradeError('entry and stopLoss must be positive');
  }
  if (!isStopOnCorrectSide(input.position, input.entry, input.stopLoss)) {
    throw new InvalidStopError(
      `stopLoss must be ${input.position === 'LONG' ? 'below' : 'above'} entry for a ${input.position} trade`
    );
  }

  // --- Daily limits (two parallel reads) ---
  const dayStart = startOfIstDay(now);
  const [activeTrades, closedToday] = await Promise.all([
    prisma.trade.count({ where: { status: 'OPEN' } }),
    prisma.trade.findMany({
      where: { closedAt: { gte: dayStart }, status: { not: 'OPEN' } },
      select: { pnl: true },
    }),
  ]);

  const dailyPnl = closedToday.reduce((sum, t) => sum + (t.pnl == null ? 0 : Number(t.pnl)), 0);

  const allowance = canOpenTrade({
    activeTrades,
    dailyPnl,
    accountEquity,
    maxActiveTrades,
    maxDailyLossPct,
  });
  if (!allowance.allowed) {
    throw new TradeLimitError(allowance.reason);
  }

  // --- 1% risk cap on quantity ---
  let cap;
  try {
    cap = calculatePositionSize({
      side: input.position,
      accountEquity,
      entryPrice: input.entry,
      stopLoss: input.stopLoss,
      riskPerTradePct,
    });
  } catch (err) {
    if (err instanceof RangeError) {
      throw new PositionSizeError(input.quantity, 0);
    }
    throw err;
  }
  if (input.quantity > cap.quantity) {
    throw new PositionSizeError(input.quantity, cap.quantity);
  }

  // --- Persist ---
  return prisma.trade.create({
    data: {
      symbol: input.symbol,
      position: input.position,
      entry: input.entry,
      stopLoss: input.stopLoss,
      takeProfit: input.takeProfit,
      quantity: input.quantity,
      pattern: input.pattern,
      strategy: input.strategy,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Close an open trade. Computes realised P&L from `exitPrice` and the entry,
 * updates status (defaults to `CLOSED`; pass `STOPPED` when the stop was hit),
 * and stamps `closedAt`.
 */
export async function closeTrade(id: string, input: CloseTradeInput): Promise<Trade> {
  const prisma = getPrisma();
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) throw new TradeNotFoundError(id);
  if (trade.status !== 'OPEN') throw new TradeNotOpenError(id);

  const pnl = calculatePnl(
    trade.position as PositionSide,
    trade.quantity,
    Number(trade.entry),
    input.exitPrice
  );

  return prisma.trade.update({
    where: { id },
    data: {
      status: input.status ?? 'CLOSED',
      exitPrice: input.exitPrice,
      pnl,
      closedAt: input.now ?? new Date(),
    },
  });
}

/**
 * Update an open trade's risk fields. A trailing stop is always clamped so
 * the position can never trail past breakeven (hard stop enforcement).
 */
export async function updateTrade(id: string, input: UpdateTradeInput): Promise<Trade> {
  const prisma = getPrisma();
  const trade = await prisma.trade.findUnique({ where: { id } });
  if (!trade) throw new TradeNotFoundError(id);
  if (trade.status !== 'OPEN') throw new TradeNotOpenError(id);

  const data: Prisma.TradeUpdateInput = {};

  if (input.stopLoss !== undefined) {
    data.stopLoss = clampTrailingStop(
      trade.position as PositionSide,
      Number(trade.entry),
      input.stopLoss
    );
  }
  if (input.takeProfit !== undefined) {
    data.takeProfit = input.takeProfit;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  return prisma.trade.update({ where: { id }, data });
}
