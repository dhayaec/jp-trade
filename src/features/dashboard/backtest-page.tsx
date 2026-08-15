'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { TrendingUp, BarChart3, Target, AlertTriangle } from 'lucide-react';
import { fetchBacktest, type BacktestMetrics } from './api';
import type { Timeframe } from '@/lib/constants';

const DEFAULT_TIMEFRAME: Timeframe = '5m';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; strategies: Array<BacktestMetrics & { strategy: string }> };

export function BacktestPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Backtest</h1>
            <p className="text-sm text-slate-500">Historical strategy performance metrics</p>
          </div>
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

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <p className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <strong className="text-slate-300">Important:</strong> Historical strategy performance ��
          probability that a current signal will succeed. Backtest results reflect past market
          conditions and should not be treated as a guarantee of future results.
        </p>
      </div>

      <BacktestPanel key={timeframe} timeframe={timeframe} />
    </div>
  );
}

function BacktestPanel({ timeframe }: { timeframe: Timeframe }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchBacktest(timeframe)
      .then((strategies) => {
        if (!cancelled) {
          setState({ status: 'ready', strategies });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load backtest results.';
          setState({ status: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  return (
    <>
      {state.status === 'loading' && (
        <div className="space-y-4">
          {['a', 'b', 'c'].map((k) => (
            <Skeleton key={k} className="h-48 w-full" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          Failed to load backtest results — {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {state.strategies.map((metrics) => (
            <StrategyCard key={metrics.strategy} metrics={metrics} />
          ))}
        </div>
      )}
    </>
  );
}

function StrategyCard({ metrics }: { metrics: BacktestMetrics & { strategy: string } }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{metrics.strategy}</h2>

      <div className="space-y-4">
        <StatRow
          label="Total Trades"
          value={metrics.totalTrades.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4 text-slate-500" />}
        />
        <StatRow
          label="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          icon={<Target className="h-4 w-4 text-emerald-400" />}
          tone={
            metrics.winRate >= 55
              ? 'text-emerald-400'
              : metrics.winRate >= 50
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatRow
          label="Profit Factor"
          value={metrics.profitFactor.toFixed(2)}
          icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
          tone={
            metrics.profitFactor >= 1.5
              ? 'text-emerald-400'
              : metrics.profitFactor >= 1.2
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatRow
          label="Avg R:R"
          value={metrics.avgRiskReward.toFixed(2)}
          icon={<Target className="h-4 w-4 text-indigo-400" />}
          tone={
            metrics.avgRiskReward >= 2
              ? 'text-emerald-400'
              : metrics.avgRiskReward >= 1.5
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatRow
          label="Expectancy"
          value={metrics.expectancy.toFixed(2)}
          icon={<TrendingUp className="h-4 w-4 text-indigo-400" />}
          tone={
            metrics.expectancy > 0
              ? 'text-emerald-400'
              : metrics.expectancy > -50
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatRow
          label="Max Drawdown"
          value={`${metrics.maxDrawdownPctDisplay.toFixed(1)}%`}
          icon={<AlertTriangle className="h-4 w-4 text-rose-400" />}
          tone={
            metrics.maxDrawdownPctDisplay <= 10
              ? 'text-emerald-400'
              : metrics.maxDrawdownPctDisplay <= 15
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
        <StatRow
          label="Sharpe Ratio"
          value={metrics.sharpeRatio.toFixed(2)}
          icon={<BarChart3 className="h-4 w-4 text-indigo-400" />}
          tone={
            metrics.sharpeRatio >= 1.5
              ? 'text-emerald-400'
              : metrics.sharpeRatio >= 1.0
                ? 'text-amber-400'
                : 'text-rose-400'
          }
        />
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          Based on {metrics.totalTrades} simulated trades. Total return:{' '}
          {metrics.totalReturnPct.toFixed(1)}%
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Expectancy: {metrics.expectancy.toFixed(2)} per trade | Open: {metrics.openTrades}
        </p>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  icon,
  tone = 'text-slate-100',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn('font-semibold tabular-nums', tone)}>{value}</p>
      </div>
    </div>
  );
}
