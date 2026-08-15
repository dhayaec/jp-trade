'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Timeframe } from '@/lib/constants';
import { formatPrice } from '@/lib/utils';
import { fetchScreen } from './api';
import type { ScreeningCandidate } from '@/features/screener/screener';
import { ScorePill } from './score-pill';
import { Skeleton } from './skeleton';
import { Star, X } from 'lucide-react';
import { removeFromWatchlist, type WatchlistItem } from './watchlist';

const STORAGE_KEY = 'jp-trade-watchlist';

function getWatchlistItems(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

interface WatchlistRow extends WatchlistItem {
  candidate?: ScreeningCandidate | undefined;
  lastClose?: number;
  changePct?: number;
}

/**
 * Watchlist view page — shows all saved symbols with their latest screener
 * score (fetched from `/api/screen` once) and a quick link to the detail page.
 */
export function WatchlistView() {
  // Lazy initializers read localStorage/fetch during render (SSR-safe).
  const [items, setItems] = useState<WatchlistItem[]>(() => getWatchlistItems());
  const [candidates, setCandidates] = useState<ScreeningCandidate[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  // Load scores on mount (no sync setState in effect)
  useEffect(() => {
    let cancelled = false;
    fetchScreen({ timeframe: '5m' as Timeframe, topN: 200, minScore: 0 })
      .then((cands) => {
        if (!cancelled) {
          setCandidates(cands);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRemove = (symbol: string) => {
    removeFromWatchlist(symbol);
    setItems(getWatchlistItems());
  };

  const candidateMap = new Map(candidates.map((c) => [c.symbol, c]));
  const rows: WatchlistRow[] = items.map((item): WatchlistRow => ({
    ...item,
    candidate: candidateMap.get(item.symbol),
  }));

  // Sort by score desc (watchlisted symbols with a score first)
  rows.sort((a, b) => (b.candidate?.score ?? -1) - (a.candidate?.score ?? -1));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Star className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Watchlist</h1>
          <p className="text-sm text-slate-500">
            {items.length} saved symbol{items.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
          <Star className="mx-auto h-10 w-10 text-slate-700" />
          <p className="mt-3 text-sm text-slate-400">Your watchlist is empty</p>
          <p className="mt-1 text-xs text-slate-600">
            Add symbols from the Screener or search in the sidebar.
          </p>
          <Link
            href="/screener"
            className="mt-4 inline-block rounded-lg bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/25"
          >
            Browse Screener
          </Link>
        </div>
      ) : status === 'loading' ? (
        <div className="space-y-2">
          {items.map((item) => (
            <Skeleton key={item.symbol} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          {rows.map((row) => (
            <div
              key={row.symbol}
              className="group flex items-center justify-between gap-3 border-b border-slate-800/60 px-4 py-3 transition-colors last:border-0 hover:bg-slate-800/30"
            >
              <Link
                href={`/screener/${row.symbol}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-100">{row.symbol}</span>
                    {row.candidate && <ScorePill score={row.candidate.score} />}
                  </div>
                  {row.candidate && (
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatPrice(row.candidate.lastClose)}</span>
                      <span>Vol: {row.candidate.volumeRatio.toFixed(1)}×</span>
                    </div>
                  )}
                  {!row.candidate && (
                    <span className="text-xs text-slate-600">Not in current screen</span>
                  )}
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  href={`/screener/${row.symbol}`}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-indigo-500/15"
                >
                  View →
                </Link>
                <button
                  onClick={() => handleRemove(row.symbol)}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                  aria-label={`Remove ${row.symbol} from watchlist`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
