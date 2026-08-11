import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { TradingSetup } from '@/features/candlestick/types';
import { cn } from '@/lib/utils';
import { formatPrice } from './format';

function StrategyCard({ setup }: { setup: TradingSetup }) {
  const isLong = setup.signal === 'BUY';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{setup.strategy}</p>
          <p className="text-xs text-slate-500">R:R {setup.riskReward.toFixed(1)}:1</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1',
            isLong
              ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 ring-rose-500/30'
          )}
        >
          {isLong ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {setup.signal}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Entry</dt>
          <dd className="font-medium text-slate-200">{formatPrice(setup.entry)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Stop</dt>
          <dd className="font-medium text-slate-200">{formatPrice(setup.stopLoss)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Target</dt>
          <dd className="font-medium text-slate-200">{formatPrice(setup.takeProfit)}</dd>
        </div>
      </dl>

      {setup.patterns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {setup.patterns.map((p) => (
            <span key={p} className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-400">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function StrategyCardList({ setups }: { setups: readonly TradingSetup[] }) {
  if (setups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">No smart-money setups right now.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {setups.map((s) => (
        <StrategyCard key={s.strategy} setup={s} />
      ))}
    </div>
  );
}
