'use client';

import { useEffect, useState } from 'react';
import type { TradeResponse } from '@/server/serializers';
import { cn } from '@/lib/utils';
import { formatPrice, formatTimestamp } from './format';
import { fetchTrades, type TradeStatus } from './api';

/**
 * Trade log with status tabs.  Fetched client-side so E2E can intercept via
 * Playwright `page.route` (no database required in CI).
 *
 * Switching tabs remounts `<TradeLogPanel />` (via `key`) so it restarts in
 * the `loading` state without calling `setState` synchronously in an effect.
 */

const STATUS_TABS: readonly TradeStatus[] = ['OPEN', 'CLOSED', 'STOPPED'];

const STATUS_STYLES: Record<TradeStatus, string> = {
  OPEN: 'bg-sky-500/15 text-sky-400 ring-sky-500/30',
  CLOSED: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  STOPPED: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; trades: TradeResponse[] };

export function TradeLog() {
  const [tab, setTab] = useState<TradeStatus>('OPEN');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Trade Log</h1>
        <p className="text-sm text-slate-500">Paper/live positions with P&L tracking.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-slate-800 transition-colors',
              tab === s
                ? 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
            )}
          >
            {s[0] + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <TradeLogPanel key={tab} tab={tab} />
    </div>
  );
}

function TradeLogPanel({ tab }: { tab: TradeStatus }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchTrades(tab)
      .then((trades) => {
        if (!cancelled) setState({ status: 'ready', trades });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load trades.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [tab]);

  return (
    <>
      {state.status === 'loading' && (
        <p className="py-16 text-center text-sm text-slate-500">Loading trades…</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {state.message}
        </div>
      )}

      {state.status === 'ready' &&
        (state.trades.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            No {tab.toLowerCase()} trades yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full min-w-180 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 text-right font-medium">Side</th>
                  <th className="px-3 py-2 text-right font-medium">Entry</th>
                  <th className="px-3 py-2 text-right font-medium">Stop</th>
                  <th className="px-3 py-2 text-right font-medium">Target</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">P&L</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {state.trades.map((t) => (
                  <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-semibold text-slate-100">{t.symbol}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{t.position}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{formatPrice(t.entry)}</td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {formatPrice(t.stopLoss)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">
                      {formatPrice(t.takeProfit)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300">{t.quantity}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-medium',
                        t.pnl == null
                          ? 'text-slate-500'
                          : t.pnl >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                      )}
                    >
                      {t.pnl == null ? '—' : formatPrice(t.pnl)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          'inline-block rounded-md px-2 py-0.5 text-xs font-medium ring-1',
                          STATUS_STYLES[t.status]
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">
                      {formatTimestamp(Date.parse(t.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
