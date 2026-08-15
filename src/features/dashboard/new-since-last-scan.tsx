'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScorePill } from './score-pill';
import type { ScreeningCandidate } from '@/features/screener/screener';

interface NewSinceLastScanProps {
  candidates: readonly ScreeningCandidate[];
  lastScanTime: Date | null;
  nextScanTime: Date | null;
}

const STORAGE_KEY = 'jp-trade-last-screen';

interface PreviousScreenData {
  timestamp: number;
  candidates: Record<string, { score: number; confidence: number }>;
}

/** Get previous screen data from localStorage. */
function getPreviousScreen(): PreviousScreenData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/** Save current screen data to localStorage. */
function saveCurrentScreen(candidates: readonly ScreeningCandidate[]): void {
  if (typeof window === 'undefined') return;
  try {
    const data: PreviousScreenData = {
      timestamp: Date.now(),
      candidates: Object.fromEntries(
        candidates.map((c) => [c.symbol, { score: c.score, confidence: c.confidence }])
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatScoreDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function getDeltaColor(delta: number): string {
  return delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-500';
}

function getSignalReason(
  current: ScreeningCandidate,
  previous: { score: number; confidence: number } | undefined
): string {
  if (!previous) return 'New candidate';
  const scoreDelta = current.score - previous.score;
  if (scoreDelta >= 10) return 'Significant score increase';
  if (scoreDelta >= 5) return 'Score improved';
  if (current.isORB && !previous) return 'ORB confirmed';
  if (current.patternCount > 0 && (previous?.score ?? 0) < current.score) return 'Pattern detected';
  if (current.volumeRatio >= 1.5) return 'Volume surge';
  return 'Qualified';
}

/** Compute the diff between current and previous screen data. */
function computeDiff(
  candidates: readonly ScreeningCandidate[],
  previousData: PreviousScreenData | null
): {
  previousData: PreviousScreenData | null;
  newCandidates: ScreeningCandidate[];
  improvedCandidates: ScreeningCandidate[];
} {
  if (!previousData) {
    return { previousData: null, newCandidates: [], improvedCandidates: [] };
  }

  const newOnes: ScreeningCandidate[] = [];
  const improved: ScreeningCandidate[] = [];

  for (const candidate of candidates) {
    const prevCandidate = previousData.candidates[candidate.symbol];
    if (!prevCandidate) {
      newOnes.push(candidate);
    } else if (candidate.score > prevCandidate.score + 2) {
      improved.push(candidate);
    }
  }

  return { previousData, newCandidates: newOnes, improvedCandidates: improved };
}

export function NewSinceLastScan({
  candidates,
  lastScanTime,
  nextScanTime,
}: NewSinceLastScanProps) {
  // Read previous screen from localStorage once
  const previousData = useMemo(() => getPreviousScreen(), []);

  // Compute diff during render (no setState in effect)
  const { newCandidates, improvedCandidates } = useMemo(
    () => computeDiff(candidates, previousData),
    [candidates, previousData]
  );

  const allHighlighted = [...newCandidates, ...improvedCandidates];

  // Save current screen data after render (fire-and-forget)
  useEffect(() => {
    if (previousData) {
      saveCurrentScreen(candidates);
    }
  }, [candidates, previousData]);

  if (allHighlighted.length === 0 && !previousData) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          New Since Last Scan
        </h2>
        <p className="text-sm text-slate-500">Run the screener again to see new signals.</p>
        {lastScanTime && (
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
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
    );
  }

  if (allHighlighted.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          New Since Last Scan
        </h2>
        <p className="text-sm text-slate-500">
          No new or significantly improved signals since last scan.
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
          {lastScanTime && (
            <span>
              Last scan:{' '}
              <span className="font-mono text-slate-300">{formatTime(lastScanTime)}</span>
            </span>
          )}
          {nextScanTime && (
            <span>
              Next scan:{' '}
              <span className="font-mono text-slate-300">{formatTime(nextScanTime)}</span>
            </span>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        New Since Last Scan
      </h2>
      <div className="space-y-2">
        {allHighlighted.map((candidate) => {
          const prev = previousData?.candidates[candidate.symbol];
          const scoreDelta = prev ? candidate.score - prev.score : null;
          const isNew = !prev;
          return (
            <Link
              key={candidate.symbol}
              href={`/screener/${candidate.symbol}`}
              className="block rounded-lg border border-slate-800 bg-slate-900/30 p-3 hover:bg-slate-800/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{candidate.symbol}</span>
                  <ScorePill score={candidate.score} />
                  {isNew && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-emerald-500/15 text-emerald-300">
                      NEW
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-right">
                  {scoreDelta !== null && (
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        getDeltaColor(scoreDelta)
                      )}
                    >
                      {formatScoreDelta(scoreDelta)}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-400">{getSignalReason(candidate, prev)}</p>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        {lastScanTime && (
          <span>
            Last scan: <span className="font-mono text-slate-300">{formatTime(lastScanTime)}</span>
          </span>
        )}
        {nextScanTime && (
          <span>
            Next scan: <span className="font-mono text-slate-300">{formatTime(nextScanTime)}</span>
          </span>
        )}
      </div>
    </section>
  );
}
