'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScorePill } from './score-pill';
import { Minus, Star, Search, X } from 'lucide-react';

const STORAGE_KEY = 'jp-trade-watchlist';

export interface WatchlistItem {
  symbol: string;
  name?: string;
  addedAt: number;
}

/** Get watchlist from localStorage. */
export function getWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Save watchlist to localStorage. */
function saveWatchlist(items: WatchlistItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

/** Add symbol to watchlist. */
export function addToWatchlist(symbol: string, name?: string): void {
  const current = getWatchlist();
  if (!current.some((item) => item.symbol === symbol)) {
    const item: WatchlistItem = { symbol, addedAt: Date.now() };
    if (name) item.name = name;
    saveWatchlist([...current, item]);
  }
}

/** Remove symbol from watchlist. */
export function removeFromWatchlist(symbol: string): void {
  const current = getWatchlist();
  saveWatchlist(current.filter((item) => item.symbol !== symbol));
}

/** Check if symbol is in watchlist. */
export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().some((item) => item.symbol === symbol);
}

/** Get watchlist symbols. */
export function getWatchlistSymbols(): string[] {
  return getWatchlist().map((item) => item.symbol);
}

interface WatchlistPanelProps {
  /** Optional: pre-fetched screening candidates for these symbols. */
  candidates?: readonly { symbol: string; score: number; confidence: number; lastClose: number }[];
  /** Callback when a symbol is removed. */
  onRemove?: (symbol: string) => void;
}

export function WatchlistPanel({ candidates = [], onRemove }: WatchlistPanelProps) {
  // Lazy initializer reads localStorage during render (SSR-safe: returns [] on
  // the server). Updates come from the handlers below, never from an effect.
  const [items, setItems] = useState<WatchlistItem[]>(() => getWatchlist());
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = (symbol: string, name?: string) => {
    addToWatchlist(symbol, name);
    setItems(getWatchlist());
  };

  const handleRemove = (symbol: string) => {
    removeFromWatchlist(symbol);
    setItems(getWatchlist());
    onRemove?.(symbol);
  };

  const candidateMap = new Map(candidates.map((c) => [c.symbol, c]));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
          <Star className="h-4 w-4 text-amber-400" />
          Watchlist ({items.length})
        </h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            isOpen ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:bg-slate-800'
          )}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="p-4 text-center text-sm text-slate-500">
          <p className="mb-2">No symbols in watchlist</p>
          <p className="text-xs">Add symbols from the Screener or Detail page</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/50">
          {items.map((item) => {
            const candidate = candidateMap.get(item.symbol);
            return (
              <Link
                key={item.symbol}
                href={`/screener/${item.symbol}`}
                className="flex items-center justify-between gap-3 p-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-semibold text-slate-100 truncate">{item.symbol}</span>
                  {candidate && (
                    <>
                      <ScorePill score={candidate.score} />
                      <span className="text-xs text-slate-500">
                        ₹{candidate.lastClose.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemove(item.symbol);
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  aria-label={`Remove ${item.symbol} from watchlist`}
                >
                  <Minus className="h-4 w-4" />
                </button>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add symbol form */}
      <AddToWatchlistForm onAdd={handleAdd} />
    </div>
  );
}

function AddToWatchlistForm({ onAdd }: { onAdd: (symbol: string, name?: string) => void }) {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleInputChange = (value: string) => {
    setSymbol(value);
    // Below the 2-char threshold there is nothing to search for — clear
    // suggestions in the handler (never in an effect) so a stale list can't
    // linger after the input is emptied.
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Debounced autocomplete fetch — setState only in async callbacks.
  useEffect(() => {
    if (symbol.length < 2) return;

    let cancelled = false;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(
          `/api/symbols/search?q=${encodeURIComponent(symbol.toUpperCase())}`
        );
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { data?: string[] };
        if (!cancelled) {
          setSuggestions(data.data ?? []);
          setShowSuggestions(true);
        }
      } catch {
        // Ignore errors
      }
    };

    const debounce = setTimeout(fetchSuggestions, 200);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [symbol]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    if (sym && !isInWatchlist(sym)) {
      onAdd(sym);
      setSymbol('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={symbol}
          onChange={(e) => handleInputChange(e.target.value.toUpperCase())}
          onFocus={() => setShowSuggestions(suggestions.length > 0)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Add symbol (e.g., RELIANCE)"
          className="w-full pl-10 pr-8 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {symbol && (
          <button
            type="button"
            onClick={() => handleInputChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="mt-2 rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          {suggestions.slice(0, 5).map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setSymbol(s);
                  setShowSuggestions(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="submit"
        disabled={!symbol.trim() || isInWatchlist(symbol.toUpperCase())}
        className="mt-2 w-full py-2 rounded-lg bg-indigo-500/15 text-indigo-300 text-sm font-medium hover:bg-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isInWatchlist(symbol.toUpperCase()) ? 'Already in Watchlist' : 'Add to Watchlist'}
      </button>
    </form>
  );
}

/** Button to add/remove a single symbol from watchlist. */
export function WatchlistButton({ symbol, name }: { symbol: string; name?: string }) {
  // Lazy initializer avoids sync setState in an effect.
  const [inWatchlist, setInWatchlist] = useState(() => isInWatchlist(symbol));

  const toggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(symbol);
    } else {
      addToWatchlist(symbol, name);
    }
    setInWatchlist(!inWatchlist);
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        inWatchlist
          ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
          : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800'
      )}
      title={inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      <Star className={cn('h-4 w-4', inWatchlist && 'fill-current')} />
      <span className="hidden sm:inline">{inWatchlist ? 'Watching' : 'Watch'}</span>
    </button>
  );
}
