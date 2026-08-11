/**
 * **Risk Engine** — pure position-sizing and trading-limit logic.
 *
 * Phase 6 of the implementation plan. Every function here is a pure function
 * with no database or clock access: inputs in, decisions out. The trade
 * lifecycle (`actions.ts`) applies these rules at the Prisma boundary; the
 * browser never computes a risk decision that matters.
 *
 * Rules enforced (from the source plan, Phase 6):
 * - Max `riskPerTradePct` (1%) risked per trade via position sizing
 * - Max `maxActiveTrades` (3) open positions at once
 * - Max `maxDailyLossPct` (2%) cumulative realised daily loss → halt
 * - Hard stop losses whose trailing floor is breakeven (never trail past entry)
 *
 * Two entry points:
 * - `calculatePositionSize` — derives a whole-share position whose money at
 *   risk equals the risk fraction of equity.
 * - `canOpenTrade` — decides whether a new position may be opened given today's
 *   open-trade count and realised P&L.
 */

import { RISK_DEFAULTS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PositionSide = 'LONG' | 'SHORT';

export interface RiskConfig {
  /**
   * Fraction of equity risked per trade. Default
   * `RISK_DEFAULTS.maxRiskPerTrade` (1%).
   */
  riskPerTradePct: number;
  /**
   * Maximum open positions allowed at once. Default
   * `RISK_DEFAULTS.maxTradesPerDay` (3).
   */
  maxActiveTrades: number;
  /**
   * Cumulative realised daily loss (fraction of equity) that halts new trades.
   * Default `RISK_DEFAULTS.maxDailyLoss` (2%).
   */
  maxDailyLossPct: number;
}

/** Production defaults sourced from `RISK_DEFAULTS` in `@/lib/constants`. */
export const DEFAULT_RISK_CONFIG: RiskConfig = {
  riskPerTradePct: RISK_DEFAULTS.maxRiskPerTrade,
  maxActiveTrades: RISK_DEFAULTS.maxTradesPerDay,
  maxDailyLossPct: RISK_DEFAULTS.maxDailyLoss,
};

// ---------------------------------------------------------------------------
// Position sizing
// ---------------------------------------------------------------------------

export interface PositionSizingInput {
  side: PositionSide;
  /** Account equity used to derive the risk budget. Must be positive. */
  accountEquity: number;
  /** Reference entry price. Must be positive. */
  entryPrice: number;
  /**
   * Hard stop. Must be on the correct side of `entryPrice` (below for LONG,
   * above for SHORT).
   */
  stopLoss: number;
  /**
   * Fraction of equity risked per share. Defaults to
   * `DEFAULT_RISK_CONFIG.riskPerTradePct`.
   */
  riskPerTradePct?: number;
}

export interface PositionSize {
  /** Whole shares the risk budget affords (floored so risk never exceeds cap). */
  quantity: number;
  /** Money at risk = `accountEquity × riskPerTradePct`. */
  riskAmount: number;
  /** Per-share distance from entry to the stop. */
  riskPerUnit: number;
  /** Notional value of the position = `quantity × entryPrice`. */
  notional: number;
}

/**
 * Size a position so the money at risk equals `riskPerTradePct` of equity.
 *
 * The stop distance (risk per unit) is the per-share distance between entry and
 * stop; quantity is floored so the true risk can never exceed the cap. Throws a
 * `RangeError` when the inputs cannot produce a valid position (invalid risk
 * fraction, non-positive equity/price, an inverted stop, or a stop so far away
 * that one share already exceeds the risk budget).
 */
export function calculatePositionSize(input: PositionSizingInput): PositionSize {
  const riskPerTradePct = input.riskPerTradePct ?? DEFAULT_RISK_CONFIG.riskPerTradePct;

  if (!(riskPerTradePct > 0 && riskPerTradePct <= 1)) {
    throw new RangeError(`riskPerTradePct must be in (0, 1], got ${riskPerTradePct}`);
  }
  if (input.accountEquity <= 0) {
    throw new RangeError('accountEquity must be positive');
  }
  if (input.entryPrice <= 0) {
    throw new RangeError('entryPrice must be positive');
  }
  if (input.stopLoss <= 0) {
    throw new RangeError('stopLoss must be positive');
  }
  if (!isStopOnCorrectSide(input.side, input.entryPrice, input.stopLoss)) {
    throw new RangeError(
      `stopLoss must be ${input.side === 'LONG' ? 'below' : 'above'} entryPrice for a ${input.side} position`
    );
  }

  const riskAmount = input.accountEquity * riskPerTradePct;
  const riskPerUnit = Math.abs(input.entryPrice - input.stopLoss);
  const quantity = Math.floor(riskAmount / riskPerUnit);

  if (quantity < 1) {
    throw new RangeError('risk per trade is too small for the stop distance');
  }

  return {
    quantity,
    riskAmount,
    riskPerUnit,
    notional: quantity * input.entryPrice,
  };
}

// ---------------------------------------------------------------------------
// Daily limits
// ---------------------------------------------------------------------------

export interface DailyLimitInput {
  /** Number of currently open positions. */
  activeTrades: number;
  /** Cumulative realised P&L for the trading day (negative = loss). */
  dailyPnl: number;
  /** Account equity used to express the daily loss limit as a fraction. */
  accountEquity: number;
  maxActiveTrades?: number;
  maxDailyLossPct?: number;
}

export type HaltReason = 'MAX_ACTIVE_TRADES' | 'DAILY_LOSS_LIMIT';

export type TradeAllowance = { allowed: true } | { allowed: false; reason: HaltReason };

/**
 * Decide whether a new trade may be opened given today's activity. Blocked
 * when the max open-trade count is reached or the cumulative daily loss
 * reaches the halt threshold.
 */
export function canOpenTrade(input: DailyLimitInput): TradeAllowance {
  const maxActiveTrades = input.maxActiveTrades ?? DEFAULT_RISK_CONFIG.maxActiveTrades;
  const maxDailyLossPct = input.maxDailyLossPct ?? DEFAULT_RISK_CONFIG.maxDailyLossPct;

  if (input.activeTrades >= maxActiveTrades) {
    return { allowed: false, reason: 'MAX_ACTIVE_TRADES' };
  }

  if (isDailyLossLimitHit(input.dailyPnl, input.accountEquity, maxDailyLossPct)) {
    return { allowed: false, reason: 'DAILY_LOSS_LIMIT' };
  }

  return { allowed: true };
}

/** True once cumulative daily losses reach `maxDailyLossPct` of equity. */
export function isDailyLossLimitHit(
  dailyPnl: number,
  accountEquity: number,
  maxDailyLossPct = DEFAULT_RISK_CONFIG.maxDailyLossPct
): boolean {
  return dailyPnl <= -maxDailyLossPct * accountEquity;
}

// ---------------------------------------------------------------------------
// Stop-loss rules
// ---------------------------------------------------------------------------

/**
 * Clamp a requested stop to the breakeven boundary so a stop can never be
 * trailed into a worse-than-breakeven level. Longs may never stop below
 * entry; shorts may never stop above entry.
 */
export function clampTrailingStop(
  side: PositionSide,
  entryPrice: number,
  stopLoss: number
): number {
  return side === 'LONG' ? Math.max(stopLoss, entryPrice) : Math.min(stopLoss, entryPrice);
}

/** A hard stop must sit on the losing side of entry: below for longs, above for shorts. */
export function isStopOnCorrectSide(
  side: PositionSide,
  entryPrice: number,
  stopLoss: number
): boolean {
  return side === 'LONG' ? stopLoss < entryPrice : stopLoss > entryPrice;
}

// ---------------------------------------------------------------------------
// P&L and reward:risk
// ---------------------------------------------------------------------------

/** Realised P&L for a closed position (signed by side). */
export function calculatePnl(
  side: PositionSide,
  quantity: number,
  entryPrice: number,
  exitPrice: number
): number {
  const perUnit = side === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
  return perUnit * quantity;
}

/**
 * Reward:risk ratio of a setup — target distance ÷ stop distance. Returns 0
 * when the stop is at breakeven (no risk denominator). Direction-agnostic:
 * both LONG and SHORT measure |target − entry| against |entry − stop|.
 */
export function calculateRewardRisk(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  return Math.abs(takeProfit - entryPrice) / risk;
}

// ---------------------------------------------------------------------------
// IST trading-day boundary
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of the current IST trading day as a UTC `Date` (NSE operates on IST). */
export function startOfIstDay(now: Date): Date {
  const istMs = now.getTime() + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const dayStartIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(dayStartIst - IST_OFFSET_MS);
}
