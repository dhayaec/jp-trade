'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchSignalHistory, type SignalHistoryResponse } from './api';
import { Skeleton } from './skeleton';
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const DEFAULT_TIMEFRAME: Timeframe = '5m';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SignalHistoryResponse };

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

export function SignalHistory() {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [hours, setHours] = useState(24);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState<'BUY' | 'SELL' | 'NEUTRAL' | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'patterns' | 'strategies'>('all');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Signal History</h1>
          <p className="text-sm text-slate-500">
            Historical pattern & strategy signals with replay
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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

        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="rounded-lg bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value={1}>Last 1 hour</option>
          <option value={4}>Last 4 hours</option>
          <option value={8}>Last 8 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={48}>Last 48 hours</option>
          <option value={168}>Last 1 week</option>
        </select>

        <input
          type="text"
          placeholder="Filter by symbol..."
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
          className="rounded-lg bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
        />

        <select
          value={signalFilter}
          onChange={(e) => setSignalFilter(e.target.value as 'BUY' | 'SELL' | 'NEUTRAL' | 'all')}
          className="rounded-lg bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Signals</option>
          <option value="BUY">Buy Only</option>
          <option value="SELL">Sell Only</option>
          <option value="NEUTRAL">Neutral Only</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | 'patterns' | 'strategies')}
          className="rounded-lg bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Types</option>
          <option value="patterns">Patterns Only</option>
          <option value="strategies">Strategies Only</option>
        </select>
      </div>

      {/* Remount on filter change so the panel restarts in the loading state */}
      <SignalHistoryPanel
        key={`${timeframe}-${hours}-${symbolFilter}-${signalFilter}-${typeFilter}`}
        timeframe={timeframe}
        hours={hours}
        {...(symbolFilter ? { symbol: symbolFilter } : {})}
        {...(signalFilter !== 'all' ? { signal: signalFilter } : {})}
        type={typeFilter}
      />
    </div>
  );
}

function SignalHistoryPanel({
  timeframe,
  hours,
  symbol,
  signal,
  type,
}: {
  timeframe: Timeframe;
  hours: number;
  symbol?: string;
  signal?: 'BUY' | 'SELL' | 'NEUTRAL';
  type: 'all' | 'patterns' | 'strategies';
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchSignalHistory({
      timeframe,
      hours,
      ...(symbol ? { symbol } : {}),
      ...(signal ? { signal } : {}),
      limit: 200,
    })
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load signal history.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe, hours, symbol, signal]);

  const filteredPatterns =
    type === 'strategies'
      ? []
      : state.status === 'ready'
        ? state.data.patterns.filter((p) => !signal || p.signal === signal)
        : [];

  const filteredStrategies =
    type === 'patterns'
      ? []
      : state.status === 'ready'
        ? state.data.strategies.filter((s) => !signal || s.signal === signal)
        : [];

  return (
    <>
      {/* Summary cards */}
      {state.status === 'ready' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Pattern Signals"
            count={filteredPatterns.length}
            tone="text-sky-400"
            icon={<Zap className="h-5 w-5" />}
          />
          <SummaryCard
            label="Strategy Signals"
            count={filteredStrategies.length}
            tone="text-indigo-400"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <SummaryCard
            label="Buy Signals"
            count={
              [...filteredPatterns, ...filteredStrategies].filter((s) => s.signal === 'BUY').length
            }
            tone="text-emerald-400"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <SummaryCard
            label="Sell Signals"
            count={
              [...filteredPatterns, ...filteredStrategies].filter((s) => s.signal === 'SELL').length
            }
            tone="text-rose-400"
            icon={<TrendingDown className="h-5 w-5" />}
          />
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
          Failed to load signal history — {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pattern Signals */}
          {type !== 'strategies' && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Zap className="h-4 w-4" />
                Pattern Signals ({filteredPatterns.length})
              </h2>
              {filteredPatterns.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">No pattern signals found.</p>
              ) : (
                <div className="space-y-2 max-h-150 overflow-y-auto">
                  {filteredPatterns
                    .slice()
                    .sort(
                      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .map((p) => (
                      <PatternHistoryRow
                        key={`${p.symbol}-${p.pattern}-${p.createdAt}`}
                        signal={p}
                      />
                    ))}
                </div>
              )}
            </section>
          )}

          {/* Strategy Signals */}
          {type !== 'patterns' && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <TrendingUp className="h-4 w-4" />
                Strategy Signals ({filteredStrategies.length})
              </h2>
              {filteredStrategies.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No strategy signals found.
                </p>
              ) : (
                <div className="space-y-2 max-h-150 overflow-y-auto">
                  {filteredStrategies.map((s) => (
                    <StrategyHistoryRow
                      key={`${s.symbol}-${s.strategy}-${s.computedAt}`}
                      setup={s}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}

function SummaryCard({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2">
        <span className={cn('text-lg', tone)}>{icon}</span>
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className={cn('mt-1 text-3xl font-bold tabular-nums', tone)}>{count}</p>
    </div>
  );
}

function PatternHistoryRow({
  signal,
}: {
  signal: {
    symbol: string;
    pattern: string;
    type: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    confidence: number;
    entry?: number;
    stopLoss?: number;
    takeProfit?: number;
    timeframe: string;
    timestamp: number;
    createdAt: string;
  };
}) {
  const time = new Date(signal.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  const date = new Date(signal.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <Link
      href={`/screener/${signal.symbol}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3 transition-colors hover:bg-slate-800/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{signal.symbol}</span>
          <span className="text-sm text-slate-400">{signal.pattern}</span>
          <span className="text-xs text-slate-500">({signal.type})</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {time} · {date} · {signal.timeframe} · {Math.round(signal.confidence * 100)}% confidence
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn('flex items-center gap-1 text-sm font-medium', signalTone(signal.signal))}
        >
          <SignalIcon signal={signal.signal} />
          {signal.signal}
        </span>
      </div>
    </Link>
  );
}

function StrategyHistoryRow({
  setup,
}: {
  setup: {
    symbol: string;
    strategy: string;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    entry: number;
    stopLoss: number;
    takeProfit: number;
    riskReward: number;
    confidence: number;
    patterns: string[];
    computedAt: string;
  };
}) {
  const time = new Date(setup.computedAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  const date = new Date(setup.computedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });

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
          {time} · {date} · R:R {setup.riskReward.toFixed(2)} · Patterns:{' '}
          {setup.patterns.join(', ')}
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
