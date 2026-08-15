'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchSignals, type AggregateSetup } from './api';
import { Skeleton } from './skeleton';

const DEFAULT_TIMEFRAME: Timeframe = '5m';

function signalBadge(signal: string): string {
  if (signal === 'BUY') return 'bg-emerald-500/15 text-emerald-300';
  if (signal === 'SELL') return 'bg-rose-500/15 text-rose-300';
  return 'bg-amber-500/15 text-amber-300';
}

/**
 * Strategies sub-view — smart-money setups (liquidity sweep, fair-value gap)
 * currently firing across the universe. Thin filtered wrapper over `/api/signals`.
 */
export function ScreenerStrategies() {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Strategies</h1>
          <p className="text-sm text-slate-500">Smart-money setups across the universe</p>
        </div>
        <select
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as Timeframe)}
          className="rounded-lg bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="1h">1h</option>
          <option value="1d">1d</option>
        </select>
      </header>

      <StrategiesPanel key={timeframe} timeframe={timeframe} />
    </div>
  );
}

function StrategiesPanel({ timeframe }: { timeframe: Timeframe }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; setups: AggregateSetup[] }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchSignals(timeframe)
      .then((data) => {
        if (!cancelled) {
          const setups = data.setups.slice().sort((a, b) => b.confidence - a.confidence);
          setState({ status: 'ready', setups });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load strategies.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const buy = state.status === 'ready' ? state.setups.filter((s) => s.signal === 'BUY') : [];
  const sell = state.status === 'ready' ? state.setups.filter((s) => s.signal === 'SELL') : [];

  return (
    <>
      {state.status === 'ready' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total" count={state.setups.length} tone="text-slate-200" />
          <SummaryCard label="Bullish" count={buy.length} tone="text-emerald-400" />
          <SummaryCard label="Bearish" count={sell.length} tone="text-rose-400" />
        </div>
      )}

      {state.status === 'loading' && (
        <div className="space-y-3">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <Skeleton key={k} className="h-16 w-full" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load strategies — {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <TrendingUp className="h-4 w-4" />
            Strategy Setups ({state.setups.length})
          </h2>
          {state.setups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No strategy setups detected.</p>
          ) : (
            <div className="space-y-2">
              {state.setups.map((s) => (
                <SetupRow key={`${s.symbol}-${s.strategy}`} setup={s} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function SummaryCard({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', tone)}>{count}</p>
    </div>
  );
}

function SetupRow({ setup }: { setup: AggregateSetup }) {
  return (
    <Link
      href={`/screener/${setup.symbol}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 transition-colors hover:bg-slate-800/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{setup.symbol}</span>
          <span className="text-sm text-slate-400">{setup.strategy}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          R:R {setup.riskReward.toFixed(2)}
          {setup.patterns.length > 0 && <span> · {setup.patterns.join(', ')}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
            signalBadge(setup.signal)
          )}
        >
          {setup.signal}
        </span>
        <span className="text-xs text-slate-500">{Math.round(setup.confidence * 100)}%</span>
      </div>
    </Link>
  );
}
