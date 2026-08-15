'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Candle, PatternSignal, TradingSetup } from '@/features/candlestick/types';
import type { Timeframe } from '@/lib/constants';
import { cn, formatPrice } from '@/lib/utils';
import { fetchCandidateDetail, fetchScoreHistory } from './api';
import { CandlestickChart } from './candlestick-chart';
import { ScorePill } from './score-pill';
import { Skeleton } from './skeleton';
import { Sparkline, calculateTrend } from './sparkline';
import { StatBar } from './stat-bar';
import { WhatChanged } from './what-changed';
import { WatchlistButton } from './watchlist';

import type { ConfidenceBreakdown } from '@/features/screener/screener';
import type { ScoreHistoryPoint } from './api';

interface CandidateDetail {
  symbol: string;
  score: number;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  breakdown: {
    volume: number;
    rsi: number;
    pattern: number;
    orb: number;
  };
  volumeRatio: number;
  rsi: number;
  patternCount: number;
  isORB: boolean;
  patterns: string[];
  lastClose: number;
  candles: Candle[];
  patternSignals: PatternSignal[];
  setups: TradingSetup[];
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; detail: CandidateDetail; history: ScoreHistoryPoint[] };

function getStatusLabel(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: 'QUALIFIED', tone: 'text-emerald-300' };
  if (score >= 60) return { label: 'WATCH', tone: 'text-amber-300' };
  return { label: 'REJECTED', tone: 'text-rose-300' };
}

function formatChange(value: number): string {
  return value >= 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;
}

export function ScreenerDetail({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchCandidateDetail(symbol, timeframe),
      fetchScoreHistory(symbol, timeframe, 24).catch(() => []), // don't fail on history error
    ])
      .then(([detail, history]) => {
        if (!cancelled) setState({ status: 'ready', detail, history });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load candidate detail.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  return (
    <div className="space-y-6">
      {/* Main content */}
      {state.status === 'loading' && <DetailSkeleton />}
      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load detail — {state.message}
        </div>
      )}
      {state.status === 'ready' && (
        <DetailView detail={state.detail} history={state.history} timeframe={timeframe} />
      )}
    </div>
  );
}

function DetailView({
  detail,
  history,
  timeframe,
}: {
  detail: CandidateDetail;
  history: ScoreHistoryPoint[];
  timeframe: Timeframe;
}) {
  const {
    symbol,
    score,
    confidence,
    confidenceBreakdown,
    breakdown,
    volumeRatio,
    rsi,
    patternCount,
    isORB,
    lastClose,
    candles,
    patternSignals,
    setups,
  } = detail;
  const { label: statusLabel, tone: statusTone } = getStatusLabel(score);
  const prevClose = candles[candles.length - 2]?.close ?? lastClose;
  const changePct = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0;

  // Score history for sparkline
  const scoreHistory = history.map((h) => h.score);
  const { change, changePct: scoreChangePct, sparkline } = calculateTrend(scoreHistory);

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/screener"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to Screener
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{timeframe}</span>
        </div>
      </div>

      {/* Header Card */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{symbol}</h1>
            <p className="mt-1 text-sm text-slate-500">NSE</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums text-slate-100">
                {formatPrice(lastClose)}
              </span>
              <span
                className={cn(
                  'text-lg font-semibold tabular-nums',
                  changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                )}
              >
                {formatChange(changePct)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ScorePill score={score} />
              <span
                className={cn(
                  'px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider',
                  statusTone
                )}
              >
                {statusLabel}
              </span>
              <span className="px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Confidence {confidence}%
              </span>
              <WatchlistButton symbol={symbol} />
            </div>
          </div>
        </div>
      </section>

      {/* Score History Sparkline */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Score History (24h)
        </h2>
        <Sparkline
          data={scoreHistory}
          label="Score"
          currentValue={score}
          change={change >= 0 ? `+${change}` : `${change}`}
          color="indigo"
          height={50}
        />
        <p className="mt-2 text-xs text-slate-500 font-mono">{sparkline}</p>
        {scoreHistory.length > 1 && (
          <p className="mt-1 text-sm text-slate-400">
            Score {change >= 0 ? 'increased' : 'decreased'} {Math.abs(change)} points in the last
            24h ({scoreChangePct >= 0 ? '+' : ''}
            {scoreChangePct.toFixed(1)}%).
          </p>
        )}
        {scoreHistory.length <= 1 && (
          <p className="mt-1 text-sm text-slate-500">Insufficient history for trend.</p>
        )}
      </section>

      {/* Candlestick Chart */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Price Action
        </h2>
        <CandlestickChart candles={candles} />
      </section>

      {/* Score Breakdown + Patterns/Strategies side-by-side */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column: Score Breakdown + Risk/Reward */}
        <div className="space-y-6">
          {/* Score Breakdown Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Score Breakdown
            </h2>
            <div className="space-y-4">
              <StatBar score={breakdown.volume} label="Volume" max={25} />
              <StatBar score={breakdown.rsi} label="RSI" max={20} />
              <StatBar score={breakdown.pattern} label="Patterns" max={20} />
              <StatBar score={breakdown.orb} label="ORB" max={20} />
              <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-400">Total</span>
                <span className="tabular-nums font-bold text-slate-100">{score}/100</span>
              </div>
            </div>
          </section>

          {/* Confidence Breakdown Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Confidence Breakdown
            </h2>
            <div className="space-y-4">
              <StatBar
                score={confidenceBreakdown.technicalAgreement}
                label="Technical Agreement"
                max={100}
              />
              <StatBar
                score={confidenceBreakdown.patternAgreement}
                label="Pattern Agreement"
                max={100}
              />
              <StatBar
                score={confidenceBreakdown.strategyAgreement}
                label="Strategy Agreement"
                max={100}
              />
              <div className="pt-2 border-t border-slate-800 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-400">Overall</span>
                <span className="tabular-nums font-bold text-indigo-300">
                  {confidenceBreakdown.overall}%
                </span>
              </div>
            </div>
          </section>

          {/* Risk / Reward Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Risk / Reward
            </h2>
            {setups.length > 0 ? (
              <div className="space-y-3">
                {setups.map((setup) => (
                  <RiskRewardCard
                    key={`${setup.strategy}-${setup.entry}-${setup.stopLoss}`}
                    setup={setup}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No valid setups with risk/reward data.</p>
            )}
          </section>
        </div>

        {/* Right column: Patterns + Strategies */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Patterns Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Patterns ({patternCount})
            </h2>
            {patternSignals.length > 0 ? (
              <div className="space-y-3">
                {patternSignals.map((signal) => (
                  <PatternSignalCard
                    key={`${signal.pattern}-${signal.timestamp}`}
                    signal={signal}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No confident patterns detected.</p>
            )}
          </section>

          {/* Strategies Panel */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Smart Money Setups
            </h2>
            {setups.length > 0 ? (
              <div className="space-y-3">
                {setups.map((setup) => (
                  <StrategySignalCard
                    key={`${setup.strategy}-${setup.entry}-${setup.stopLoss}`}
                    setup={setup}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No strategy setups detected.</p>
            )}
          </section>

          {/* Signal Agreement Summary */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Signal Agreement
            </h2>
            <SignalAgreementSummary
              volumeRatio={volumeRatio}
              rsi={rsi}
              patternCount={patternCount}
              isORB={isORB}
              setups={setups}
            />
          </section>

          {/* What Changed Timeline */}
          <WhatChanged history={history} />
        </div>
      </div>

      {/* Raw Data for debugging */}
      <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-slate-500">
          Debug Data
        </summary>
        <pre className="mt-3 text-[10px] text-slate-500 overflow-auto max-h-64">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function PatternSignalCard({ signal }: { signal: PatternSignal }) {
  const signalTone =
    signal.signal === 'BUY'
      ? 'text-emerald-400'
      : signal.signal === 'SELL'
        ? 'text-rose-400'
        : 'text-amber-400';
  const typeTone =
    signal.type === 'REVERSAL'
      ? 'bg-emerald-500/15 text-emerald-300'
      : signal.type === 'CONTINUATION'
        ? 'bg-indigo-500/15 text-indigo-300'
        : 'bg-amber-500/15 text-amber-300';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{signal.pattern}</span>
            <span
              className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium uppercase', typeTone)}
            >
              {signal.type}
            </span>
            <span
              className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium uppercase', signalTone)}
            >
              {signal.signal}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{signal.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {signal.entry && <span>Entry: {formatPrice(signal.entry)}</span>}
            {signal.stopLoss && <span>SL: {formatPrice(signal.stopLoss)}</span>}
            {signal.takeProfit && <span>TP: {formatPrice(signal.takeProfit)}</span>}
            <span>Confidence: {Math.round(signal.confidence * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategySignalCard({ setup }: { setup: TradingSetup }) {
  const signalTone =
    setup.signal === 'BUY'
      ? 'text-emerald-400'
      : setup.signal === 'SELL'
        ? 'text-rose-400'
        : 'text-amber-400';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-100">{setup.strategy}</span>
            <span
              className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium uppercase', signalTone)}
            >
              {setup.signal}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Entry: {formatPrice(setup.entry)}</span>
            <span>SL: {formatPrice(setup.stopLoss)}</span>
            <span>TP: {formatPrice(setup.takeProfit)}</span>
            <span>R:R: {setup.riskReward.toFixed(2)}</span>
            <span>Confidence: {Math.round(setup.confidence * 100)}%</span>
          </div>
          {setup.patterns.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Patterns: {setup.patterns.join(', ')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskRewardCard({ setup }: { setup: TradingSetup }) {
  const risk = setup.entry - setup.stopLoss;
  const reward = setup.takeProfit - setup.entry;
  const rr = reward / risk;
  const rrTone = rr >= 2 ? 'text-emerald-400' : rr >= 1.5 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-100">{setup.strategy}</span>
        <span className={cn('font-bold text-lg', rrTone)}>{rr.toFixed(2)}</span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Entry</p>
          <p className="font-semibold text-slate-100">{formatPrice(setup.entry)}</p>
        </div>
        <div>
          <p className="text-slate-500">Stop Loss</p>
          <p className="font-semibold text-rose-400">{formatPrice(setup.stopLoss)}</p>
        </div>
        <div>
          <p className="text-slate-500">Target</p>
          <p className="font-semibold text-emerald-400">{formatPrice(setup.takeProfit)}</p>
        </div>
        <div>
          <p className="text-slate-500">Risk</p>
          <p className="font-semibold text-slate-300">{formatPrice(risk)}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500/70"
          style={{ width: `${Math.min(100, (rr / 3) * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">
        R:R {rr.toFixed(2)} (target {rr >= 2 ? 'acceptable' : rr >= 1.5 ? 'marginal' : 'poor'})
      </p>
    </div>
  );
}

function SignalAgreementSummary({
  volumeRatio,
  rsi,
  patternCount,
  isORB,
  setups,
}: {
  volumeRatio: number;
  rsi: number;
  patternCount: number;
  isORB: boolean;
  setups: TradingSetup[];
}) {
  const hasLiquiditySweep = setups.some((s) => s.strategy === 'Liquidity Sweep');
  const hasFVG = setups.some((s) => s.strategy === 'Fair Value Gap');

  const signals = [
    { label: 'Volume', good: volumeRatio >= 1.5, value: `${volumeRatio.toFixed(1)}×` },
    { label: 'RSI', good: rsi >= 50 && rsi <= 65, value: rsi.toFixed(1) },
    { label: 'Pattern', good: patternCount > 0, value: `${patternCount} detected` },
    { label: 'ORB', good: isORB, value: isORB ? 'Breakout' : 'Inside range' },
    {
      label: 'Liq. Sweep',
      good: hasLiquiditySweep,
      value: hasLiquiditySweep ? 'Detected' : 'None',
    },
    { label: 'FVG', good: hasFVG, value: hasFVG ? 'Detected' : 'None' },
  ];

  const agreementCount = signals.filter((s) => s.good).length;
  const agreementPct = Math.round((agreementCount / signals.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">Agreement</span>
        <span className="text-lg font-bold text-indigo-300">{agreementPct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500/70"
          style={{ width: `${agreementPct}%` }}
        />
      </div>
      <div className="space-y-1.5">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{s.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 tabular-nums">{s.value}</span>
              <span
                className={cn('h-2 w-2 rounded-full', s.good ? 'bg-emerald-500' : 'bg-slate-700')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
