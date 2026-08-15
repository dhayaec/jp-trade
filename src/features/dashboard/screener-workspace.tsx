'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ScreeningCandidate } from '@/features/screener/screener';
import type { Timeframe } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { fetchScreen } from './api';
import { ScorePill } from './score-pill';
import { FILTER_DEFAULTS, ScreeningFilters, type ScreeningFiltersState } from './screening-filters';
import { compareCandidates, type CandidateSortKey, type SortDirection } from './screening-table';
import { SignalMatrix } from './signal-matrix';
import { Skeleton } from './skeleton';
import { StatBar } from './stat-bar';
import { NewSinceLastScan } from './new-since-last-scan';
import { WatchlistButton } from './watchlist';

interface LoadState {
  status: 'loading' | 'error' | 'ready';
  candidates: ScreeningCandidate[];
}

/**
 * Stock Selection workspace — the primary screen.
 *
 * Renders the ranked list of candidates (from `GET /api/screen`) alongside a
 * filter panel. Each row is clickable and deep-links to
 * `/screener/[symbol]` for the full evidence stack.
 *
 * Changing the timeframe or any filter remounts `<ScreenerResults />` (via
 * `key`) so it restarts in the `loading` state — this avoids calling `setState`
 * synchronously inside the fetch effect (a React 19 lint rule).
 */
export function ScreenerWorkspace() {
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [filters, setFilters] = useState<ScreeningFiltersState>({});

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Filter panel */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ScreeningFilters
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          value={filters}
          onChange={setFilters}
        />
      </aside>

      {/* Ranked list — remounts on filter change to reset to the loading state. */}
      <ScreenerResults
        key={`${timeframe}:${filters.topN ?? ''}:${filters.minScore ?? ''}:${filters.orbPeriod ?? ''}:${filters.volumeLookback ?? ''}:${filters.universe ?? ''}:${filters.sector ?? ''}:${filters.minPrice ?? ''}:${filters.maxPrice ?? ''}:${filters.minVolumeRatio ?? ''}:${filters.minRsi ?? ''}:${filters.maxRsi ?? ''}:${filters.patterns?.join(',') ?? ''}:${filters.strategies?.join(',') ?? ''}:${filters.minRiskReward ?? ''}`}
        timeframe={timeframe}
        filters={filters}
      />
    </div>
  );
}

function ScreenerResults({
  timeframe,
  filters,
}: {
  timeframe: Timeframe;
  filters: ScreeningFiltersState;
}) {
  const [sortKey, setSortKey] = useState<CandidateSortKey>('score');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [state, setState] = useState<LoadState>({ status: 'loading', candidates: [] });
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [nextScanTime, setNextScanTime] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Defaults guarantee every optional field resolves to a concrete number.
    const resolved = { ...FILTER_DEFAULTS, ...filters };
    fetchScreen({
      timeframe,
      topN: resolved.topN,
      minScore: resolved.minScore,
      orbPeriod: resolved.orbPeriod,
      volumeLookback: resolved.volumeLookback,
      universe: resolved.universe,
      sector: resolved.sector,
      minPrice: resolved.minPrice,
      maxPrice: resolved.maxPrice,
      minVolumeRatio: resolved.minVolumeRatio,
      minRsi: resolved.minRsi,
      maxRsi: resolved.maxRsi,
      patterns: resolved.patterns.length > 0 ? resolved.patterns.join(',') : '',
      strategies: resolved.strategies.length > 0 ? resolved.strategies.join(',') : '',
      minRiskReward: resolved.minRiskReward,
    })
      .then((candidates) => {
        if (!cancelled) {
          const now = new Date();
          setState({ status: 'ready', candidates });
          setLastScanTime(now);
          // Next scan in 5 minutes (assuming 5m timeframe cadence)
          setNextScanTime(new Date(now.getTime() + 5 * 60 * 1000));
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', candidates: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe, filters]);

  const sorted = useMemo(
    () => [...state.candidates].sort((a, b) => compareCandidates(a, b, sortKey, sortDir)),
    [state.candidates, sortKey, sortDir]
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Today&apos;s Opportunities
        </h2>
        {state.status === 'ready' && (
          <span className="text-sm text-slate-500">{state.candidates.length} candidates</span>
        )}
      </div>

      {state.status === 'loading' && <ScreenerSkeleton />}
      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 px-4 py-8 text-center text-sm text-rose-300">
          Failed to load screening results. Refresh to retry.
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <NewSinceLastScan
            candidates={sorted}
            lastScanTime={lastScanTime}
            nextScanTime={nextScanTime}
          />
          <CandidateTable
            candidates={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key) => {
              if (key === sortKey) {
                setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
              } else {
                setSortKey(key);
                setSortDir(key === 'symbol' ? 'asc' : 'desc');
              }
            }}
          />
          {sorted.length > 0 && <SignalMatrix candidates={sorted.slice(0, 5)} />}
        </>
      )}
    </section>
  );
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

function ScreenerSkeleton() {
  return (
    <div className="space-y-3">
      {SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <div className="w-2/3 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-14" />
        </div>
      ))}
    </div>
  );
}

function CandidateTable({
  candidates,
  sortKey,
  sortDir,
  onSort,
}: {
  candidates: readonly ScreeningCandidate[];
  sortKey: CandidateSortKey;
  sortDir: SortDirection;
  onSort: (key: CandidateSortKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs uppercase tracking-wider text-slate-500 sm:grid-cols-[2.5rem_1fr_6rem_6rem_6rem_6rem]">
        <span>#</span>
        <SortableHeader
          label="Stock"
          active={sortKey === 'symbol'}
          dir={sortDir}
          onClick={() => onSort('symbol')}
        />
        <SortableHeader
          label="Volume"
          active={sortKey === 'volumeRatio'}
          dir={sortDir}
          onClick={() => onSort('volumeRatio')}
          className="hidden sm:inline-flex"
        />
        <SortableHeader
          label="RSI"
          active={sortKey === 'rsi'}
          dir={sortDir}
          onClick={() => onSort('rsi')}
          className="hidden sm:inline-flex"
        />
        <SortableHeader
          label="Patterns"
          active={sortKey === 'patternCount'}
          dir={sortDir}
          onClick={() => onSort('patternCount')}
          className="hidden sm:inline-flex"
        />
        <SortableHeader
          label="Score"
          active={sortKey === 'score'}
          dir={sortDir}
          onClick={() => onSort('score')}
        />
      </div>

      {candidates.map((c, i) => (
        <CoverRow key={c.symbol} candidate={c} rank={i + 1} />
      ))}

      {candidates.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          No candidates meet the current screen threshold.
        </p>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDirection;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center font-medium text-slate-500 hover:text-slate-300',
        active && 'text-indigo-300',
        className
      )}
    >
      {label}
      {active && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

/** One ranked candidate row; the whole row is a link to its detail page. */
function CoverRow({ candidate, rank }: { candidate: ScreeningCandidate; rank: number }) {
  return (
    <Link
      href={`/screener/${candidate.symbol}`}
      className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-b border-slate-800/60 px-3 py-3 transition-colors last:border-0 hover:bg-slate-800/30"
    >
      <span className="text-sm font-semibold text-slate-600">{rank}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-slate-100">{candidate.symbol}</span>
          <ScorePill score={candidate.score} />
        </div>
        <div className="mt-0.5 hidden gap-3 text-xs text-slate-500 sm:flex">
          {candidate.breakdown && <StatBar score={candidate.breakdown.volume} label="Vol" />}
          {candidate.breakdown && <StatBar score={candidate.breakdown.rsi} label="RSI" />}
          {candidate.breakdown && <StatBar score={candidate.breakdown.pattern} label="Pat" />}
          {candidate.breakdown && <StatBar score={candidate.breakdown.orb} label="ORB" />}
        </div>
      </div>
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="hidden text-right text-sm text-slate-400 sm:block">
          {Math.round(candidate.rsi)}
        </span>
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          <WatchlistButton symbol={candidate.symbol} />
        </div>
      </div>
    </Link>
  );
}
