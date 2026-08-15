'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchSignals, type AggregateSetup, type AggregateSignal } from './api';
import { Skeleton } from './skeleton';
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; patterns: AggregateSignal[]; setups: AggregateSetup[] };

const DEFAULT_TIMEFRAME: Timeframe = '5m';

function signalTone(signal: string): string {
  if (signal === 'BUY') return 'text-emerald-400';
  if (signal === 'SELL') return 'text-rose-400';
  return 'text-amber-400';
}

function signalBadge(signal: string): string {
  if (signal === 'BUY') return 'bg-emerald-500/15 text-emerald-300';
  if (signal === 'SELL') return 'bg-rose-500/15 text-rose-300';
  return 'bg-amber-500/15 text-amber-300';
}

function SignalIcon({ signal }: { signal: string }) {
  if (signal === 'BUY') return <TrendingUp className="h-4 w-4" />;
  if (signal === 'SELL') return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

export function SignalsPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Signals</h1>
          <p className="text-sm text-slate-500">
            Live pattern & strategy signals across the universe
          </p>
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
      </div>

      {/* Remount on timeframe change so the panel restarts in the loading state
          (avoids calling setState synchronously inside the fetch effect). */}
      <SignalsPanel key={timeframe} timeframe={timeframe} />
    </div>
  );
}

function SignalsPanel({ timeframe }: { timeframe: Timeframe }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchSignals(timeframe)
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', patterns: data.patterns, setups: data.setups });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load signals.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const buyPatterns =
    state.status === 'ready' ? state.patterns.filter((p) => p.signal === 'BUY') : [];
  const sellPatterns =
    state.status === 'ready' ? state.patterns.filter((p) => p.signal === 'SELL') : [];
  const buySetups = state.status === 'ready' ? state.setups.filter((s) => s.signal === 'BUY') : [];
  const sellSetups =
    state.status === 'ready' ? state.setups.filter((s) => s.signal === 'SELL') : [];

  return (
    <>
      {/* Summary cards */}
      {state.status === 'ready' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Bullish Patterns"
            count={buyPatterns.length}
            tone="text-emerald-400"
          />
          <SummaryCard label="Bearish Patterns" count={sellPatterns.length} tone="text-rose-400" />
          <SummaryCard label="Bullish Setups" count={buySetups.length} tone="text-emerald-400" />
          <SummaryCard label="Bearish Setups" count={sellSetups.length} tone="text-rose-400" />
        </div>
      )}

      {/* Content */}
      {state.status === 'loading' && (
        <div className="space-y-3">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
            <Skeleton key={k} className="h-16 w-full" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load signals — {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pattern Signals */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Zap className="h-4 w-4" />
              Pattern Signals ({state.patterns.length})
            </h2>
            {state.patterns.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No pattern signals detected.
              </p>
            ) : (
              <div className="space-y-2">
                {state.patterns
                  .slice()
                  .sort((a, b) => b.confidence - a.confidence)
                  .map((p) => (
                    <PatternSignalRow key={`${p.symbol}-${p.pattern}`} signal={p} />
                  ))}
              </div>
            )}
          </section>

          {/* Strategy Setups */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-4 w-4" />
              Strategy Setups ({state.setups.length})
            </h2>
            {state.setups.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No strategy setups detected.
              </p>
            ) : (
              <div className="space-y-2">
                {state.setups.map((s) => (
                  <SetupRow key={`${s.symbol}-${s.strategy}`} setup={s} />
                ))}
              </div>
            )}
          </section>
        </div>
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

function PatternSignalRow({ signal }: { signal: AggregateSignal }) {
  return (
    <Link
      href={`/screener/${signal.symbol}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 transition-colors hover:bg-slate-800/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{signal.symbol}</span>
          <span className="text-sm text-slate-400">{signal.pattern}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{signal.description}</p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn('flex items-center gap-1 text-sm font-medium', signalTone(signal.signal))}
        >
          <SignalIcon signal={signal.signal} />
          {signal.signal}
        </span>
        <span className="text-xs text-slate-500">{Math.round(signal.confidence * 100)}%</span>
      </div>
    </Link>
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
        <p className="mt-0.5 text-xs text-slate-500">R:R {setup.riskReward.toFixed(2)}</p>
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
