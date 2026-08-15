'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchScreen } from './api';
import type { ScreeningCandidate } from '@/features/screener/screener';
import { ScorePill } from './score-pill';
import { Skeleton } from './skeleton';
import { StatBar } from './stat-bar';

const DEFAULT_TIMEFRAME: Timeframe = '5m';

interface ScreenerTechnicalProps {
  timeframe: Timeframe;
}

function ScreenerTechnicalResults({ timeframe }: ScreenerTechnicalProps) {
  const [candidates, setCandidates] = useState<ScreeningCandidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Initial state is loading; fetch in effect
  // We rely on parent remounting via `key` to reset to loading state
  // This avoids calling setState synchronously inside the effect body
  const fetchData = async () => {
    try {
      const cands = await fetchScreen({ timeframe, topN: 100, minScore: 0 });
      setCandidates(cands);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  // Fire-and-forget; component will remount on timeframe change
  // so we don't need cleanup/cancellation logic
  fetchData();

  return (
    <>
      {status === 'loading' && (
        <div className="space-y-3">
          {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key) => (
            <Skeleton key={key} className="h-16 w-full" />
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load technical screener.
        </div>
      )}

      {status === 'ready' && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wider text-slate-500 sm:grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem_6rem]">
            <span>#</span>
            <span className="font-medium">Stock</span>
            <span className="hidden sm:inline-flex">Volume</span>
            <span className="hidden sm:inline-flex">RSI</span>
            <span className="hidden sm:inline-flex">ORB</span>
            <span className="hidden sm:inline-flex">Score</span>
          </div>

          {candidates.map((c, i) => (
            <Link
              key={c.symbol}
              href={`/screener/${c.symbol}`}
              className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-b border-slate-800/60 px-3 py-3 transition-colors last:border-0 hover:bg-slate-800/30 sm:grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem_6rem]"
            >
              <span className="text-sm font-semibold text-slate-600">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-slate-100">{c.symbol}</span>
                  <ScorePill score={c.score} />
                </div>
                <div className="mt-0.5 hidden gap-3 text-xs text-slate-500 sm:flex">
                  <StatBar score={c.breakdown?.volume ?? 0} label="Vol" max={25} />
                  <StatBar score={c.breakdown?.rsi ?? 0} label="RSI" max={20} />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-right">
                <span className="w-20 text-slate-400 tabular-nums">
                  {c.volumeRatio.toFixed(1)}×
                </span>
                <span className="w-16 text-slate-400 tabular-nums">{Math.round(c.rsi)}</span>
                <span
                  className={cn(
                    'w-16 font-medium',
                    c.isORB ? 'text-emerald-400' : 'text-slate-500'
                  )}
                >
                  {c.isORB ? '���' : '—'}
                </span>
                <span className="w-16 text-slate-100 tabular-nums font-semibold">{c.score}</span>
              </div>
            </Link>
          ))}

          {candidates.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No candidates meet the current screen threshold.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function ScreenerTechnical() {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Technical Screener</h1>
          <p className="text-sm text-slate-500">Ranked by volume, RSI, and ORB signals</p>
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

      <ScreenerTechnicalResults key={timeframe} timeframe={timeframe} />
    </div>
  );
}
