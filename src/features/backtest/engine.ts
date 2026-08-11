/**
 * **Backtest engine** — validate a strategy on historical candles before going
 * live (Phase 7.1).
 *
 * Pure function over candle data, mirroring the Phase 2/3 strategy detectors
 * and the Phase 6 risk engine: no database, no clock. Given a strategy
 * detector, it walks candles left-to-right, enters when a setup fires, sizes
 * the position with `calculatePositionSize`, simulates the trade forward until
 * the stop or take-profit is touched, and records the outcome.
 *
 * Model (kept deliberately simple and documented):
 * - **One position at a time** — after a trade closes, scanning resumes the
 *   bar *after* the exit, so signals seen while a trade is open are skipped.
 * - **Entry at the setup's own `entry` price** (each strategy chooses it, e.g.
 *   the signal candle's close); exit checks start on the next bar.
 * - **Stop resolves first** — when a single bar touches both stop and target,
 *   the trade is closed as a loss (conservative; intra-bar order is unknown).
 * - **Open trades** close at the last candle's close and are marked `OPEN`
 *   (never counted as wins/losses by the metrics).
 * - Live-trading risk limits (max 3 positions, 2% daily-loss halt) belong to
 *   the Phase 6 risk engine and are *not* applied here — a backtest isolates
 *   signal quality from account-management policy.
 */

import type { Candle, TradingSetup } from '@/features/candlestick/types';
import { at } from '@/features/candlestick/utils';
import { calculatePnl, calculatePositionSize, type PositionSide } from '@/features/trading/risk';

export type BacktestTradeResult = 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';

export interface BacktestTrade {
  /** Index into the input candles where the entry signal fired. */
  entryIndex: number;
  /** Index of the candle whose low/high resolved the exit. */
  exitIndex: number;
  entryTimestamp: number;
  exitTimestamp: number;
  side: PositionSide;
  strategy: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  /** Filled exit price — the stop/target level, or the last close when OPEN. */
  exit: number;
  /** Whole shares from `calculatePositionSize` at entry. */
  quantity: number;
  /** Signed realised P&L at the fill price. */
  pnl: number;
  result: BacktestTradeResult;
}

/** A strategy detector: given candles up to the current bar, return a setup. */
export type BacktestStrategy = (candles: readonly Candle[]) => TradingSetup | null;

export interface BacktestOptions {
  /**
   * Strategy detector run on each prefix of the candle series. Compatible with
   * `detectLiquiditySweep`, `detectFairValueGap`, or any wrapper over
   * `CandlestickPatternEngine`. Must be a pure function of its input.
   */
  strategy: BacktestStrategy;
  /** Starting equity used for position sizing. Default `100_000`. */
  initialCapital?: number;
  /** Fraction of equity risked per trade. Default `0.01` (1%). */
  riskPerTradePct?: number;
}

export interface BacktestResult {
  /** Closed and open trades, in entry order. */
  trades: BacktestTrade[];
  initialCapital: number;
  /** `initialCapital` plus the sum of all trade P&L. */
  finalEquity: number;
}

const DEFAULT_INITIAL_CAPITAL = 100_000;
const DEFAULT_RISK_PER_TRADE_PCT = 0.01;

/**
 * Run `options.strategy` over `candles`, simulating entries and exits to a
 * list of trades. Candles are sorted ascending by timestamp first; the output
 * preserves entry order.
 */
export function runBacktest(candles: readonly Candle[], options: BacktestOptions): BacktestResult {
  const initialCapital = options.initialCapital ?? DEFAULT_INITIAL_CAPITAL;
  const riskPerTradePct = options.riskPerTradePct ?? DEFAULT_RISK_PER_TRADE_PCT;
  const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);

  const trades: BacktestTrade[] = [];
  let equity = initialCapital;

  let i = 0;
  while (i < sorted.length) {
    const setup = options.strategy(sorted.slice(0, i + 1));

    if (!setup || setup.signal === 'NEUTRAL') {
      i += 1;
      continue;
    }

    const side: PositionSide = setup.signal === 'BUY' ? 'LONG' : 'SHORT';

    // Signals that can't be sized (unaffordable, inverted stop) are skipped.
    let quantity: number;
    try {
      quantity = calculatePositionSize({
        side,
        accountEquity: equity,
        entryPrice: setup.entry,
        stopLoss: setup.stopLoss,
        riskPerTradePct,
      }).quantity;
    } catch {
      i += 1;
      continue;
    }

    const entryCandle = at(sorted, i);
    const lastBar = at(sorted, sorted.length - 1);
    let exit = lastBar.close;
    let exitIndex = sorted.length - 1;
    let result: BacktestTradeResult = 'OPEN';

    for (let j = i + 1; j < sorted.length; j++) {
      const bar = at(sorted, j);
      const hitStop = side === 'LONG' ? bar.low <= setup.stopLoss : bar.high >= setup.stopLoss;
      const hitTarget =
        side === 'LONG' ? bar.high >= setup.takeProfit : bar.low <= setup.takeProfit;

      if (hitStop) {
        exit = setup.stopLoss;
        result = 'LOSS';
      } else if (hitTarget) {
        exit = setup.takeProfit;
        result = 'WIN';
      } else {
        continue;
      }
      exitIndex = j;
      break;
    }

    const pnl = calculatePnl(side, quantity, setup.entry, exit);
    if (result !== 'OPEN' && pnl === 0) result = 'BREAKEVEN';

    trades.push({
      entryIndex: i,
      exitIndex,
      entryTimestamp: entryCandle.timestamp,
      exitTimestamp: at(sorted, exitIndex).timestamp,
      side,
      strategy: setup.strategy,
      entry: setup.entry,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      exit,
      quantity,
      pnl,
      result,
    });

    equity += pnl;

    // Resume scanning after the exit bar (one position at a time).
    i = exitIndex + 1;
  }

  return { trades, initialCapital, finalEquity: equity };
}
