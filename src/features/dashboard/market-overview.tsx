'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Zap, AlertCircle, Target, Clock } from 'lucide-react';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchScreen, type ScreenParams } from './api';
import type { ScreeningCandidate } from '@/features/screener/screener';
import { ScorePill } from './score-pill';
import { Skeleton } from './skeleton';

interface MarketOverviewProps {
  timeframe: Timeframe;
}

/**
 * Market Overview Dashboard — UI-PLAN §8 "Top Opportunities"
 *
 * Four sections:
 * 1. Market Status (open/closed, current time, timeframe)
 * 2. Top Score / Biggest Volume / New Signals summary cards
 * 3. Top Candidates table (ranked table with key metrics)
 */
export function MarketOverview({ timeframe }: MarketOverviewProps) {
  const [candidates, setCandidates] = useState<ScreeningCandidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [nextScanTime, setNextScanTime] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const params: ScreenParams = { timeframe, topN: 50, minScore: 0 };
    fetchScreen(params)
      .then((cands) => {
        if (!cancelled) {
          setCandidates(cands);
          setStatus('ready');
          const now = new Date();
          setLastScanTime(now);
          setNextScanTime(new Date(now.getTime() + 5 * 60 * 1000));
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const topScore = candidates[0];
  const biggestVolume = [...candidates].sort((a, b) => b.volumeRatio - a.volumeRatio)[0];

  // Calculate new signals count (would compare with localStorage in production)
  const newSignalsCount = candidates.filter((c) => c.score >= 70).length;

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
  }

  function getMarketStatus(): { label: string; isOpen: boolean; tone: string } {
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const dayOfWeek = istTime.getDay();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const marketOpen = hours > 9 || (hours === 9 && minutes >= 15);
    const marketClose = hours > 15 || (hours === 15 && minutes >= 30);
    const isOpen = !isWeekend && marketOpen && !marketClose;

    return {
      label: isOpen
        ? 'OPEN'
        : isWeekend
          ? 'CLOSED (WEEKEND)'
          : marketClose
            ? 'CLOSED'
            : 'PRE-MARKET',
      isOpen,
      tone: isOpen ? 'text-emerald-400' : 'text-rose-400',
    };
  }

  const market = getMarketStatus();

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        Failed to load market overview.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Status Banner */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                market.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              )}
            />
            <div>
              <p className="text-sm font-semibold text-slate-300">NSE Market</p>
              <p className={cn('text-xs font-medium uppercase tracking-wider', market.tone)}>
                {market.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(new Date())} IST
            </span>
            <span className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {timeframe}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Top Score"
          icon={<TrendingUp className="h-5 w-5 text-indigo-400" />}
          value={topScore ? `${topScore.symbol} ${topScore.score}/100` : '—'}
          subtitle={
            topScore
              ? `Volume ${topScore.volumeRatio.toFixed(1)}× · RSI ${Math.round(topScore.rsi)}`
              : 'No data'
          }
          tone="text-indigo-400"
          href={topScore ? `/screener/${topScore.symbol}` : undefined}
        />
        <SummaryCard
          label="Biggest Volume"
          icon={<Zap className="h-5 w-5 text-amber-400" />}
          value={
            biggestVolume ? `${biggestVolume.symbol} ${biggestVolume.volumeRatio.toFixed(1)}×` : '—'
          }
          subtitle={
            biggestVolume
              ? `Score ${biggestVolume.score}/100 · RSI ${Math.round(biggestVolume.rsi)}`
              : 'No data'
          }
          tone="text-amber-400"
          href={biggestVolume ? `/screener/${biggestVolume.symbol}` : undefined}
        />
        <SummaryCard
          label="New Signals"
          icon={<AlertCircle className="h-5 w-5 text-emerald-400" />}
          value={`${newSignalsCount} qualified`}
          subtitle="Score ≥ 70 in current scan"
          tone="text-emerald-400"
          href="/screener"
        />
      </div>

      {/* Top Candidates Table */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
            <Target className="h-4 w-4" />
            Top Candidates ({candidates.length})
          </h2>
          <Link
            href="/screener"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            View All →
          </Link>
        </div>

        {candidates.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No candidates found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Volume</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">RSI</th>
                  <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">
                    Patterns
                  </th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">ORB</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {candidates.slice(0, 10).map((c, i) => (
                  <tr
                    key={c.symbol}
                    className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-600 font-medium">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/screener/${c.symbol}`}
                        className="flex items-center gap-2 font-semibold text-slate-100 hover:text-indigo-300 transition-colors"
                      >
                        {c.symbol}
                        <ScorePill score={c.score} />
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 hidden sm:table-cell tabular-nums">
                      {c.volumeRatio.toFixed(1)}×
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 hidden sm:table-cell tabular-nums">
                      {Math.round(c.rsi)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400 hidden sm:table-cell tabular-nums">
                      {c.patternCount}
                    </td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          c.isORB ? 'text-emerald-400' : 'text-slate-500'
                        )}
                      >
                        {c.isORB ? '��� Breakout' : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-100 tabular-nums">
                      {c.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastScanTime && (
          <div className="border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              Last scan:{' '}
              <span className="font-mono text-slate-300">{formatTime(lastScanTime)}</span>
            </span>
            {nextScanTime && (
              <span>
                Next scan:{' '}
                <span className="font-mono text-slate-300">{formatTime(nextScanTime)}</span>
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  subtitle: string;
  tone: string;
  href?: string | undefined;
}

function SummaryCard({ label, icon, value, subtitle, tone, href }: SummaryCardProps) {
  const content = (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
          <p className={cn('mt-1 text-lg font-bold tabular-nums', tone)}>{value}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="shrink-0 p-2 rounded-lg bg-slate-800/50">{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}
