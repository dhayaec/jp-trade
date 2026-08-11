'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ScreeningCandidate } from '@/features/screener/screener';
import { cn } from '@/lib/utils';
import { formatPrice, formatRatio } from './format';

// ---------------------------------------------------------------------------
// Sort state — exported comparator is pure and unit-tested.
// ---------------------------------------------------------------------------

export type CandidateSortKey =
  'symbol' | 'score' | 'lastClose' | 'volumeRatio' | 'rsi' | 'patternCount';

export type SortDirection = 'asc' | 'desc';

/** Pure comparator — exported so `tests/features/dashboard/screening-table.test.ts` can cover it. */
export function compareCandidates(
  a: ScreeningCandidate,
  b: ScreeningCandidate,
  key: CandidateSortKey,
  direction: SortDirection
): number {
  const dir = direction === 'asc' ? 1 : -1;

  if (key === 'symbol') {
    return a.symbol.localeCompare(b.symbol) * dir;
  }

  const av = a[key] as number;
  const bv = b[key] as number;
  return (av - bv) * dir;
}

// ---------------------------------------------------------------------------
// Column config
// ---------------------------------------------------------------------------

const COLUMNS: ReadonlyArray<{ key: CandidateSortKey; label: string; align?: 'right' }> = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'lastClose', label: 'Close', align: 'right' },
  { key: 'volumeRatio', label: 'Vol', align: 'right' },
  { key: 'rsi', label: 'RSI', align: 'right' },
  { key: 'patternCount', label: 'Patterns', align: 'right' },
  { key: 'score', label: 'Score', align: 'right' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScreeningTable({ candidates }: { candidates: readonly ScreeningCandidate[] }) {
  const [sortKey, setSortKey] = useState<CandidateSortKey>('score');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const sorted = useMemo(
    () => [...candidates].sort((a, b) => compareCandidates(a, b, sortKey, sortDir)),
    [candidates, sortKey, sortDir]
  );

  function toggle(key: CandidateSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
      <table className="w-full min-w-130 text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
            {COLUMNS.map(({ key, label, align }) => (
              <th
                key={key}
                className={cn('px-3 py-2 font-medium', align === 'right' && 'text-right')}
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-slate-300',
                    align === 'right' && 'flex-row-reverse'
                  )}
                >
                  {label}
                  {sortKey === key ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.symbol} className="border-b border-slate-800/60 hover:bg-slate-800/30">
              <td className="px-3 py-2 font-semibold text-slate-100">{c.symbol}</td>
              <td className="px-3 py-2 text-right text-slate-300">{formatPrice(c.lastClose)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{formatRatio(c.volumeRatio)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{Math.round(c.rsi)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{c.patternCount}</td>
              <td className="px-3 py-2 text-right">
                <span className="inline-flex items-center rounded-md bg-indigo-500/15 px-2 py-0.5 font-semibold text-indigo-300">
                  {c.score}
                </span>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate-500">
                No candidates meet the screen threshold.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
