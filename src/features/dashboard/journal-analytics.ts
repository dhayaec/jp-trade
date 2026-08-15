/**
 * Personal trading journal analytics — pure functions over a trader's logged
 * trades.
 *
 * All metrics are derived client-side from `TradeResponse[]` (the same payload
 * the Trade Log table renders) so no new API endpoint is required. Keeping the
 * math side-effect-free makes it trivially unit-testable and reusable from both
 * the summary cards and the equity-curve chart.
 *
 * Resolved trades (status `CLOSED` or `STOPPED`) carry a realized `pnl`; open
 * trades are excluded from win-rate / P&L math but reported separately so the
 * trader can see unrealized exposure.
 */

import type { TradeResponse } from '@/server/serializers';

export interface JournalAnalytics {
  /** Resolved trades (CLOSED or STOPPED) used for the P&L math. */
  resolvedTrades: number;
  /** Open trades excluded from the math but shown for context. */
  openTrades: number;
  /** Count of resolved wins (pnl > 0). */
  wins: number;
  /** Count of resolved losses (pnl <= 0). Breakeven counts as a loss. */
  losses: number;
  /** Win rate as a 0–100 percentage. */
  winRate: number;
  /** Sum of realized P&L across resolved trades. */
  totalPnl: number;
  /** Average winning-trade P&L (0 when no wins). */
  avgWin: number;
  /** Average losing-trade P&L (<= 0 when there are losses). */
  avgLoss: number;
  /** Gross profit / |gross loss| (0 when no losses). */
  profitFactor: number;
  /** Average P&L per resolved trade. */
  expectancy: number;
  /**
   * Largest peak-to-trough decline on the cumulative realized-equity curve,
   * as a positive currency amount. 0 when equity never falls.
   */
  maxDrawdown: number;
  /** Unrealized P&L summed across open trades (0 when none / unknown). */
  openPnl: number;
}

/** Realized P&L of a trade, or `null` when it is still open / unset. */
function realizedPnl(t: TradeResponse): number | null {
  if (t.status === 'OPEN' || t.pnl == null) return null;
  return t.pnl;
}

/**
 * Compute journal analytics from a full list of trades.
 *
 * @param trades  Every trade the trader has logged (any status).
 * @returns       Aggregated metrics; all-zero when there are no resolved trades.
 */
export function computeJournalAnalytics(trades: readonly TradeResponse[]): JournalAnalytics {
  const resolved = trades.filter((t) => realizedPnl(t) !== null);
  const open = trades.filter((t) => t.status === 'OPEN');

  const pnls = resolved.map((t) => realizedPnl(t) as number).sort((a, b) => a - b); // stable time-agnostic ordering fallback

  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p <= 0);
  const totalPnl = pnls.reduce((sum, p) => sum + p, 0);
  const grossProfit = wins.reduce((sum, p) => sum + p, 0);
  const grossLoss = losses.reduce((sum, p) => sum + p, 0);

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const profitFactor =
    grossLoss < 0 ? grossProfit / Math.abs(grossLoss) : grossProfit > 0 ? Infinity : 0;

  // Equity curve in chronological (trade-close) order for drawdown.
  const ordered = [...resolved].sort(
    (a, b) =>
      (a.closedAt ? Date.parse(a.closedAt) : Date.parse(a.updatedAt)) -
      (b.closedAt ? Date.parse(b.closedAt) : Date.parse(b.updatedAt))
  );
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of ordered) {
    running += realizedPnl(t) as number;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }

  const openPnl = open.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return {
    resolvedTrades: resolved.length,
    openTrades: open.length,
    wins: wins.length,
    losses: losses.length,
    winRate: pnls.length > 0 ? (wins.length / pnls.length) * 100 : 0,
    totalPnl,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy: pnls.length > 0 ? totalPnl / pnls.length : 0,
    maxDrawdown,
    openPnl,
  };
}

/**
 * Build the cumulative realized-equity curve for charting.
 *
 * @returns  Array of `{ t, equity }` points in chronological close order,
 *           each `equity` the running sum of realized P&L up to that point.
 */
export function equityCurve(
  trades: readonly TradeResponse[]
): Array<{ t: number; equity: number }> {
  const resolved = trades
    .filter((t) => realizedPnl(t) !== null)
    .sort(
      (a, b) =>
        (a.closedAt ? Date.parse(a.closedAt) : Date.parse(a.updatedAt)) -
        (b.closedAt ? Date.parse(b.closedAt) : Date.parse(b.updatedAt))
    );

  let running = 0;
  return resolved.map((t) => {
    running += realizedPnl(t) as number;
    const tMs = t.closedAt ? Date.parse(t.closedAt) : Date.parse(t.updatedAt);
    return { t: tMs, equity: running };
  });
}
