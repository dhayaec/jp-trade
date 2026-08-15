import { describe, expect, it } from 'vitest';
import {
  computeJournalAnalytics,
  equityCurve,
  type JournalAnalytics,
} from '@/features/dashboard/journal-analytics';
import type { TradeResponse } from '@/server/serializers';

/** Build a minimal `TradeResponse` with only the fields analytics touches. */
function trade(overrides: Partial<TradeResponse>): TradeResponse {
  return {
    id: overrides.id ?? 't1',
    symbol: overrides.symbol ?? 'RELIANCE',
    position: overrides.position ?? 'LONG',
    entry: overrides.entry ?? 100,
    stopLoss: overrides.stopLoss ?? 95,
    takeProfit: overrides.takeProfit ?? 110,
    quantity: overrides.quantity ?? 10,
    pattern: overrides.pattern ?? 'MARUBOZU',
    strategy: overrides.strategy ?? 'ORB',
    status: overrides.status ?? 'CLOSED',
    exitPrice: overrides.exitPrice ?? null,
    pnl: overrides.pnl ?? null,
    notes: overrides.notes ?? null,
    createdAt: overrides.createdAt ?? '2026-08-01T09:15:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-01T09:15:00.000Z',
    closedAt: overrides.closedAt ?? '2026-08-01T10:15:00.000Z',
  };
}

describe('computeJournalAnalytics', () => {
  it('returns zeros when there are no resolved trades', () => {
    const a = computeJournalAnalytics([trade({ status: 'OPEN', pnl: null })]);
    expect(a.resolvedTrades).toBe(0);
    expect(a.openTrades).toBe(1);
    expect(a.winRate).toBe(0);
    expect(a.totalPnl).toBe(0);
    expect(a.profitFactor).toBe(0);
    expect(a.maxDrawdown).toBe(0);
  });

  it('computes win rate, sums and averages', () => {
    const trades = [
      trade({ id: 'a', pnl: 100, closedAt: '2026-08-01T10:00:00.000Z' }),
      trade({ id: 'b', pnl: 200, closedAt: '2026-08-01T11:00:00.000Z' }),
      trade({ id: 'c', pnl: -50, closedAt: '2026-08-01T12:00:00.000Z' }),
      trade({ id: 'd', pnl: -50, closedAt: '2026-08-01T13:00:00.000Z' }),
    ];
    const a = computeJournalAnalytics(trades);
    expect(a.resolvedTrades).toBe(4);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(2);
    expect(a.winRate).toBeCloseTo(50, 5);
    expect(a.totalPnl).toBe(200);
    expect(a.avgWin).toBeCloseTo(150, 5);
    expect(a.avgLoss).toBeCloseTo(-50, 5);
    expect(a.expectancy).toBeCloseTo(50, 5);
    expect(a.profitFactor).toBeCloseTo(3, 5);
  });

  it('excludes open trades from win-rate math but reports them', () => {
    const trades = [trade({ id: 'a', pnl: 100 }), trade({ id: 'b', status: 'OPEN', pnl: null })];
    const a = computeJournalAnalytics(trades);
    expect(a.resolvedTrades).toBe(1);
    expect(a.openTrades).toBe(1);
    expect(a.wins).toBe(1);
    expect(a.winRate).toBeCloseTo(100, 5);
    expect(a.openPnl).toBe(0);
  });

  it('sums open P&L when present', () => {
    const a = computeJournalAnalytics([trade({ id: 'a', status: 'OPEN', pnl: 25 })]);
    expect(a.openPnl).toBe(25);
  });

  it('computes max drawdown on the cumulative equity curve', () => {
    // Equity path: +100 -> +50 (drawdown 50) -> +150 (peak 150, drawdown 100 from peak)
    const trades = [
      trade({ id: 'a', pnl: 100, closedAt: '2026-08-01T10:00:00.000Z' }),
      trade({ id: 'b', pnl: -50, closedAt: '2026-08-01T11:00:00.000Z' }),
      trade({ id: 'c', pnl: 100, closedAt: '2026-08-01T12:00:00.000Z' }),
    ];
    const a = computeJournalAnalytics(trades);
    expect(a.maxDrawdown).toBeCloseTo(50, 5);
  });

  it('treats breakeven (pnl == 0) as a loss', () => {
    const a = computeJournalAnalytics([trade({ id: 'a', pnl: 0 }), trade({ id: 'b', pnl: 50 })]);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.winRate).toBeCloseTo(50, 5);
  });

  it('reports infinite profit factor when gross loss is zero', () => {
    const a: JournalAnalytics = computeJournalAnalytics([
      trade({ id: 'a', pnl: 10 }),
      trade({ id: 'b', pnl: 20 }),
    ]);
    expect(a.profitFactor).toBe(Infinity);
  });
});

describe('equityCurve', () => {
  it('returns chronological cumulative points', () => {
    const trades = [
      trade({ id: 'a', pnl: 100, closedAt: '2026-08-01T10:00:00.000Z' }),
      trade({ id: 'b', pnl: -40, closedAt: '2026-08-01T11:00:00.000Z' }),
      trade({ id: 'c', pnl: 60, closedAt: '2026-08-01T12:00:00.000Z' }),
    ];
    const curve = equityCurve(trades);
    expect(curve).toHaveLength(3);
    expect(curve[0]?.equity).toBe(100);
    expect(curve[1]?.equity).toBe(60);
    expect(curve[2]?.equity).toBe(120);
  });

  it('ignores open trades', () => {
    const curve = equityCurve([trade({ id: 'a', status: 'OPEN', pnl: null })]);
    expect(curve).toHaveLength(0);
  });
});
