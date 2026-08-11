'use client';

import { NSE_UNIVERSE, TIMEFRAMES } from '@/lib/constants';
import type { Timeframe } from '@/lib/constants';

interface Props {
  symbol: string;
  timeframe: Timeframe;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

const SELECT_CLASSES =
  'rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30';

export function Controls({ symbol, timeframe, onSymbolChange, onTimeframeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Symbol
        <select
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          className={SELECT_CLASSES}
        >
          {NSE_UNIVERSE.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.symbol}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-400">
        Timeframe
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
          className={SELECT_CLASSES}
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
