'use client';

import { cn } from '@/lib/utils';
import { formatPrice } from './format';
import { computeJournalAnalytics, equityCurve } from './journal-analytics';
import type { TradeResponse } from '@/server/serializers';
import { Sparkline } from './sparkline';

/**
 * Personal trading journal analytics — the P2 "journal analytics" panel from
 * UI-PLAN.md. Computed 100% client-side from the logged trades so no new API
 * endpoint is needed. Shows summary cards (win rate, total P&L, profit factor,
 * expectancy, max drawdown, open exposure) plus a cumulative equity-curve
 * sparkline.
 */
export function JournalStats({ trades }: { trades: readonly TradeResponse[] }) {
  const a = computeJournalAnalytics(trades);
  const curve = equityCurve(trades);
  const equitySeries = curve.map((p) => p.equity);

  const pnlTone = a.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400';
  const openTone = a.openPnl >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Win Rate"
          value={`${a.winRate.toFixed(1)}%`}
          sub={`${a.wins}W / ${a.losses}L`}
          tone={
            a.winRate >= 55
              ? 'text-emerald-400'
              : a.winRate >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatCard
          label="Total P&L"
          value={formatPrice(a.totalPnl)}
          sub={`${a.resolvedTrades} closed`}
          tone={pnlTone}
        />
        <StatCard
          label="Profit Factor"
          value={Number.isFinite(a.profitFactor) ? a.profitFactor.toFixed(2) : '∞'}
          sub={
            a.profitFactor >= 1.5 ? 'healthy' : a.profitFactor >= 1 ? 'marginal' : 'unprofitable'
          }
          tone={
            a.profitFactor >= 1.5
              ? 'text-emerald-400'
              : a.profitFactor >= 1
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatCard
          label="Expectancy"
          value={formatPrice(a.expectancy)}
          sub={`avg/trade`}
          tone={a.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <StatCard
          label="Max Drawdown"
          value={formatPrice(a.maxDrawdown)}
          sub="peak → trough"
          tone={
            a.maxDrawdown === 0
              ? 'text-slate-400'
              : a.maxDrawdown <= 1000
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatCard
          label="Open Exposure"
          value={`${a.openTrades} · ${formatPrice(a.openPnl)}`}
          sub="unrealized"
          tone={a.openTrades === 0 ? 'text-slate-400' : openTone}
        />
      </div>

      {curve.length >= 2 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Cumulative Realized P&L
          </h2>
          <Sparkline
            data={equitySeries}
            color={a.totalPnl >= 0 ? 'emerald' : 'rose'}
            height={56}
            label="Equity"
            currentValue={a.totalPnl}
            change={a.totalPnl >= 0 ? `+${formatPrice(a.totalPnl)}` : formatPrice(a.totalPnl)}
          />
          <p className="mt-2 text-xs text-slate-500">
            Avg win {formatPrice(a.avgWin)} · Avg loss {formatPrice(a.avgLoss)}
          </p>
        </section>
      )}

      {a.resolvedTrades === 0 && (
        <p className="text-sm text-slate-500">
          No closed trades yet — analytics appear once you log and close positions.
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}
