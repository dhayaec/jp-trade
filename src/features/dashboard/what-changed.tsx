'use client';

import { cn } from '@/lib/utils';
import type { ScoreHistoryPoint } from './api';

interface WhatChangedProps {
  history: ScoreHistoryPoint[];
}

/** Human-readable reason for score change. */
function formatChangeReason(reason: string | null | undefined): string {
  if (!reason || reason === 'NEW') return 'Initial scan';
  if (reason === 'STABLE') return 'No significant change';
  if (reason === 'MULTIPLE') return 'Multiple factors';

  const reasons: Record<string, string> = {
    VOLUME: 'Volume increased',
    RSI: 'RSI confirmation',
    PATTERN: 'Pattern detected',
    ORB: 'ORB confirmed',
  };

  return reasons[reason] ?? reason;
}

/** Format timestamp to HH:MM. */
function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Get color for delta. */
function getDeltaColor(delta: number | null | undefined): string {
  if (!delta || delta === 0) return 'text-slate-500';
  return delta > 0 ? 'text-emerald-400' : 'text-rose-400';
}

function getDeltaIcon(delta: number | null | undefined): string {
  if (!delta || delta === 0) return '';
  return delta > 0 ? '���' : '���';
}

export function WhatChanged({ history }: WhatChangedProps) {
  // Filter to entries with changeReason and sort by time ascending
  const changes = history.filter((h) => h.changeReason && h.changeReason !== 'STABLE').slice(-10); // Last 10 changes

  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          What Changed?
        </h2>
        <p className="text-sm text-slate-500">No significant changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        What Changed?
      </h2>
      <div className="space-y-2">
        {changes.map((entry, i) => (
          <div
            key={`${entry.timestamp}-${entry.scoreDelta ?? i}`}
            className={cn(
              'flex items-center gap-3 text-sm',
              i === changes.length - 1 && 'text-slate-100'
            )}
          >
            <span className="w-14 shrink-0 text-xs font-mono tabular-nums text-slate-500">
              {formatTime(entry.timestamp)}
            </span>
            <span className={cn('flex-1 text-slate-300', getDeltaColor(entry.scoreDelta))}>
              {formatChangeReason(entry.changeReason)}
            </span>
            {entry.scoreDelta !== null && entry.scoreDelta !== undefined && (
              <span
                className={cn(
                  'flex items-center gap-1 font-semibold tabular-nums',
                  getDeltaColor(entry.scoreDelta)
                )}
              >
                {getDeltaIcon(entry.scoreDelta)} {Math.abs(entry.scoreDelta)}
              </span>
            )}
            <span className="w-14 shrink-0 text-xs font-mono tabular-nums text-slate-500 text-right">
              {entry.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
