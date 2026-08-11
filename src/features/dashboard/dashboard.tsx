'use client';

import { useEffect, useState } from 'react';
import type { Candle, PatternSignal, TradingSetup } from '@/features/candlestick/types';
import type { ScreeningCandidate } from '@/features/screener/screener';
import { NSE_UNIVERSE } from '@/lib/constants';
import type { Timeframe } from '@/lib/constants';
import { fetchCandles, fetchPatterns, fetchScreen, fetchSetups } from './api';
import { CandlestickChart } from './candlestick-chart';
import { Controls } from './controls';
import { PatternCardList } from './pattern-card';
import { ScreeningTable } from './screening-table';
import { StrategyCardList } from './strategy-card';

/**
 * Client-side dashboard panel.
 *
 * Data is fetched in the browser so that CI / E2E can intercept requests via
 * Playwright `page.route` (the E2E environment has no database). Locally
 * against a running dev-server the API routes serve real data.
 *
 * Changing the symbol or timeframe remounts `<DashboardPanel />` (via `key`)
 * so it restarts in the `loading` state — this avoids calling `setState`
 * synchronously inside the fetch effect (a React 19 lint rule).
 */

interface DashboardData {
  candles: Candle[];
  patterns: PatternSignal[];
  setups: TradingSetup[];
  screen: ScreeningCandidate[];
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & DashboardData);

const DEFAULT_SYMBOL = NSE_UNIVERSE[0]?.symbol ?? 'TCS';

export function Dashboard() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState<Timeframe>('1d');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Trading Dashboard</h1>
          <p className="text-sm text-slate-500">
            {symbol} · {timeframe}
          </p>
        </div>
        <Controls
          symbol={symbol}
          timeframe={timeframe}
          onSymbolChange={setSymbol}
          onTimeframeChange={setTimeframe}
        />
      </div>

      <DashboardPanel key={`${symbol}:${timeframe}`} symbol={symbol} timeframe={timeframe} />
    </div>
  );
}

function DashboardPanel({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchScreen(timeframe),
      fetchCandles(symbol, timeframe),
      fetchPatterns(symbol, timeframe),
      fetchSetups(symbol, timeframe),
    ])
      .then(([screen, candles, patterns, setups]) => {
        if (!cancelled) {
          setState({ status: 'ready', screen, candles, patterns, setups });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load market data.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  return (
    <>
      {state.status === 'loading' && (
        <p className="py-16 text-center text-sm text-slate-500">Loading market data…</p>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load market data — is the server running? ({state.message})
        </div>
      )}

      {state.status === 'ready' && (
        <>
          {/* Price chart */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Price Action
            </h2>
            <CandlestickChart candles={state.candles} />
          </section>

          {/* Patterns + Setups side-by-side */}
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Patterns
              </h2>
              <PatternCardList signals={state.patterns} />
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Smart Money Setups
              </h2>
              <StrategyCardList setups={state.setups} />
            </section>
          </div>

          {/* Screener table */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Top Screeners
            </h2>
            <ScreeningTable candidates={state.screen} />
          </section>
        </>
      )}
    </>
  );
}
