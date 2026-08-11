/**
 * **Backtest metrics** — summarise a list of `BacktestTrade` into the standard
 * performance statistics (Phase 7.2). Pure function, no database or clock.
 *
 * Scope conventions (documented so numbers are interpretable):
 * - **Closed trades** (`WIN` / `LOSS` / `BREAKEVEN`) drive win rate, profit
 *   factor, expectancy and Sharpe. `OPEN` trades are never counted as results.
 * - **Equity curve** (used for max drawdown and `totalPnl`) includes *every*
 *   trade in order — the engine force-closes `OPEN` trades at the last close,
 *   so `initialCapital + totalPnl` always equals the engine's `finalEquity`.
 * - **Sharpe ratio** is *per-trade*, not annualised: `mean(return) / stdev(return)`
 *   where each return is `pnl / equityAtEntry`. Annualisation would need
 *   time-bucketed (e.g. daily) returns, which this framework does not assume.
 */

import type { BacktestTrade } from './engine';

export interface BacktestMetrics {
  /** Closed trades only (`WIN` + `LOSS` + `BREAKEVEN`). */
  totalTrades: number;
  /** Trades still `OPEN` at the end of the data (excluded from all ratios). */
  openTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** `wins / totalTrades` (0 when there are no closed trades). */
  winRate: number;
  /** Sum of winning closed-trade P&L. */
  grossProfit: number;
  /** Magnitude (positive) of losing closed-trade P&L. */
  grossLoss: number;
  /** `grossProfit / grossLoss`; `Infinity` when there are no losses. */
  profitFactor: number;
  /** Peak-to-trough drop of the equity curve, in currency units. */
  maxDrawdown: number;
  /** `maxDrawdown` as a fraction of the equity peak reached before the drop. */
  maxDrawdownPct: number;
  /** Mean return ÷ sample stdev of per-trade returns (per-trade Sharpe). */
  sharpeRatio: number;
  averageWin: number;
  /** Average loss as a positive magnitude. */
  averageLoss: number;
  /** Mean P&L per closed trade. */
  expectancy: number;
  /** Sum of P&L across all trades (matches engine `finalEquity − initialCapital`). */
  totalPnl: number;
}

/**
 * Compute `BacktestMetrics` from a trade list. `initialCapital` anchors the
 * equity curve used for drawdown and total-return figures.
 */
export function calculateMetrics(
  trades: readonly BacktestTrade[],
  initialCapital: number
): BacktestMetrics {
  const closed = trades.filter((t) => t.result !== 'OPEN');

  const wins = closed.filter((t) => t.result === 'WIN');
  const losses = closed.filter((t) => t.result === 'LOSS');
  const breakeven = closed.filter((t) => t.result === 'BREAKEVEN');

  const grossProfit = wins.reduce((sum, t) => sum + Math.max(t.pnl, 0), 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

  const closedPnl = closed.reduce((sum, t) => sum + t.pnl, 0);
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

  // Equity curve including all trades (in entry order) for drawdown figures.
  // `maxDrawdownPct` is relative to the peak reached *before* each drawdown,
  // not the final peak.
  let equity = initialCapital;
  let peak = initialCapital;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const trade of trades) {
    equity += trade.pnl;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    maxDrawdown = Math.max(maxDrawdown, dd);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak === 0 ? 0 : dd / peak);
  }

  // Per-trade Sharpe over closed trades: each return is pnl ÷ equity at entry.
  const returns: number[] = [];
  let runningEquity = initialCapital;
  for (const trade of closed) {
    returns.push(trade.pnl / runningEquity);
    runningEquity += trade.pnl;
  }
  const meanReturn = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);
  const stdev = sampleStdDev(returns, meanReturn);
  // Division by zero when every return is identical → Sharpe is undefined; 0 is
  // the convention used throughout this module for undefined metrics.
  const sharpeRatio = stdev === 0 ? 0 : meanReturn / stdev;

  return {
    totalTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: closed.length === 0 ? 0 : wins.length / closed.length,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : grossProfit / grossLoss,
    maxDrawdown,
    maxDrawdownPct,
    sharpeRatio,
    averageWin: wins.length === 0 ? 0 : grossProfit / wins.length,
    averageLoss: losses.length === 0 ? 0 : grossLoss / losses.length,
    expectancy: closed.length === 0 ? 0 : closedPnl / closed.length,
    totalPnl,
  };
}

/** Sample standard deviation (n−1); 0 when there are fewer than 2 returns. */
function sampleStdDev(returns: readonly number[], mean: number): number {
  if (returns.length < 2) return 0;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance);
}
