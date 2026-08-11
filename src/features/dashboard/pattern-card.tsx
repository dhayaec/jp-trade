import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { PatternSignal, Signal } from '@/features/candlestick/types';
import { cn } from '@/lib/utils';
import { formatPercent, formatPrice } from './format';

const SIGNAL_STYLES: Record<Signal, { badge: string; icon: typeof ArrowUpRight }> = {
  BUY: {
    badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
    icon: ArrowUpRight,
  },
  SELL: {
    badge: 'bg-rose-500/15 text-rose-400 ring-rose-500/30',
    icon: ArrowDownRight,
  },
  NEUTRAL: {
    badge: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
    icon: Minus,
  },
};

function PatternCard({ signal }: { signal: PatternSignal }) {
  const style = SIGNAL_STYLES[signal.signal];
  const Icon = style.icon;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{signal.pattern}</p>
          <p className="text-xs text-slate-500">{signal.type.toLowerCase()}</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1',
            style.badge
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {signal.signal}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-400">{signal.description}</p>

      {/* Confidence bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>Confidence</span>
          <span>{formatPercent(signal.confidence)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.round(signal.confidence * 100)}%` }}
          />
        </div>
      </div>

      {/* Optional levels */}
      {(signal.entry !== undefined ||
        signal.stopLoss !== undefined ||
        signal.takeProfit !== undefined) && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          {signal.entry !== undefined && (
            <div>
              <dt className="text-slate-500">Entry</dt>
              <dd className="font-medium text-slate-200">{formatPrice(signal.entry)}</dd>
            </div>
          )}
          {signal.stopLoss !== undefined && (
            <div>
              <dt className="text-slate-500">Stop</dt>
              <dd className="font-medium text-slate-200">{formatPrice(signal.stopLoss)}</dd>
            </div>
          )}
          {signal.takeProfit !== undefined && (
            <div>
              <dt className="text-slate-500">Target</dt>
              <dd className="font-medium text-slate-200">{formatPrice(signal.takeProfit)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

export function PatternCardList({ signals }: { signals: readonly PatternSignal[] }) {
  if (signals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No patterns detected in the trailing window.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {signals.map((s) => (
        <PatternCard key={`${s.pattern}-${s.timestamp}`} signal={s} />
      ))}
    </div>
  );
}
