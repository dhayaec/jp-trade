'use client';

import { useId } from 'react';
import type { Timeframe } from '@/lib/constants';
import { TIMEFRAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** Active filter selections, matching the params `GET /api/screen` accepts. */
export interface ScreeningFiltersState {
  topN?: number;
  minScore?: number;
  orbPeriod?: number;
  volumeLookback?: number;
}

/** The fully-resolved filter set (defaults applied) — all fields required. */
export interface ResolvedFilters {
  topN: number;
  minScore: number;
  orbPeriod: number;
  volumeLookback: number;
}

export const FILTER_DEFAULTS: ResolvedFilters = {
  topN: 25,
  minScore: 60,
  orbPeriod: 5,
  volumeLookback: 20,
};

function NumberSetting({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-500">{value}</span>
      </label>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onCommit(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
      />
    </div>
  );
}

export function ScreeningFilters({
  timeframe,
  onTimeframeChange,
  value,
  onChange,
  className,
}: {
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  value: ScreeningFiltersState;
  onChange: (next: ScreeningFiltersState) => void;
  className?: string;
}) {
  // Defaults guarantee every resolved field is a concrete number.
  const merged: ResolvedFilters = { ...FILTER_DEFAULTS, ...value };

  function set<K extends keyof ResolvedFilters>(key: K, v: number) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className={cn('rounded-xl border border-slate-800 bg-slate-900/40 p-4', className)}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Screener
      </h2>

      <div className="space-y-4">
        {/* Timeframe */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">Timeframe</span>
          <div className="grid grid-cols-5 gap-1 rounded-lg bg-slate-800/60 p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange(tf)}
                className={cn(
                  'rounded-md px-1 py-1 text-xs font-medium transition-colors',
                  tf === timeframe
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Minimum score */}
        <NumberSetting
          label="Minimum score"
          value={merged.minScore}
          min={0}
          max={100}
          step={5}
          onCommit={(v) => set('minScore', v)}
        />

        {/* Opening-range period */}
        <NumberSetting
          label="ORB period"
          value={merged.orbPeriod}
          min={3}
          max={10}
          onCommit={(v) => set('orbPeriod', v)}
        />

        {/* Volume lookback */}
        <NumberSetting
          label="Volume lookback"
          value={merged.volumeLookback}
          min={5}
          max={50}
          step={5}
          onCommit={(v) => set('volumeLookback', v)}
        />

        {/* Results count */}
        <NumberSetting
          label="Results"
          value={merged.topN}
          min={5}
          max={50}
          step={5}
          onCommit={(v) => set('topN', v)}
        />
      </div>
    </div>
  );
}
