'use client';

import { useId } from 'react';
import type { Timeframe } from '@/lib/constants';
import { TIMEFRAMES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/** Available pattern filters (matches engine pattern names). */
export const PATTERN_FILTERS = ['Marubozu', 'Hammer', 'Engulfing', 'Sakata'] as const;

/** Available strategy filters. */
export const STRATEGY_FILTERS = ['Liquidity Sweep', 'Fair Value Gap', 'ORB'] as const;

/** Universe scope for the screener. */
export type UniverseScope = 'ALL' | 'NSE500' | 'NIFTY50' | 'NIFTY_NEXT50' | 'SECTOR' | 'WATCHLIST';

export const UNIVERSE_SCOPES: { value: UniverseScope; label: string }[] = [
  { value: 'ALL', label: 'All Active' },
  { value: 'NSE500', label: 'NSE 500' },
  { value: 'NIFTY50', label: 'Nifty 50' },
  { value: 'NIFTY_NEXT50', label: 'Nifty Next 50' },
  { value: 'SECTOR', label: 'Sector' },
  { value: 'WATCHLIST', label: 'Custom Watchlist' },
];

/** Active filter selections, matching the params `GET /api/screen` accepts. */
export interface ScreeningFiltersState {
  universe?: UniverseScope;
  sector?: string;
  minPrice?: number;
  maxPrice?: number;
  minVolumeRatio?: number;
  minRsi?: number;
  maxRsi?: number;
  patterns?: string[];
  strategies?: string[];
  minRiskReward?: number;
  topN?: number;
  minScore?: number;
  orbPeriod?: number;
  volumeLookback?: number;
}

/** The fully-resolved filter set (defaults applied) — all fields required. */
export interface ResolvedFilters {
  universe: UniverseScope;
  sector: string;
  minPrice: number;
  maxPrice: number;
  minVolumeRatio: number;
  minRsi: number;
  maxRsi: number;
  patterns: string[];
  strategies: string[];
  minRiskReward: number;
  topN: number;
  minScore: number;
  orbPeriod: number;
  volumeLookback: number;
}

export const FILTER_DEFAULTS: ResolvedFilters = {
  universe: 'ALL',
  sector: '',
  minPrice: 50,
  maxPrice: 5000,
  minVolumeRatio: 1.5,
  minRsi: 30,
  maxRsi: 70,
  patterns: [],
  strategies: [],
  minRiskReward: 1.5,
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

function RangeSetting({
  label,
  low,
  high,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string;
  low: number;
  high: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (low: number, high: number) => void;
}) {
  const lowId = useId();
  const highId = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-500">
          {low} — {high}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          id={lowId}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(e) => onCommit(Math.min(Number(e.target.value), high), high)}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
        />
        <input
          type="range"
          id={highId}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(e) => onCommit(low, Math.max(Number(e.target.value), low))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-indigo-500"
        />
      </div>
    </div>
  );
}

function CheckboxGroup({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40'
                : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
            )}
          >
            {opt}
          </button>
        );
      })}
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
  // Defaults guarantee every resolved field is a concrete value.
  const merged: ResolvedFilters = { ...FILTER_DEFAULTS, ...value };

  function set<K extends keyof ResolvedFilters>(key: K, v: ResolvedFilters[K]) {
    onChange({ ...value, [key]: v });
  }

  function toggleInArray(key: 'patterns' | 'strategies', item: string) {
    const current = merged[key];
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    onChange({ ...value, [key]: next });
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

        {/* Universe */}
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-400">Universe</span>
          <select
            value={merged.universe}
            onChange={(e) => set('universe', e.target.value as UniverseScope)}
            className="w-full rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {UNIVERSE_SCOPES.map((scope) => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
          {merged.universe === 'SECTOR' && (
            <input
              type="text"
              placeholder="e.g. Banking"
              value={merged.sector}
              onChange={(e) => set('sector', e.target.value)}
              className="mt-1.5 w-full rounded-lg bg-slate-800/60 border border-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Price range */}
        <RangeSetting
          label="Price (₹)"
          low={merged.minPrice}
          high={merged.maxPrice}
          min={10}
          max={10000}
          step={10}
          onCommit={(low, high) => {
            set('minPrice', low);
            set('maxPrice', high);
          }}
        />

        {/* Volume ratio */}
        <NumberSetting
          label="Min volume ratio"
          value={merged.minVolumeRatio}
          min={1}
          max={5}
          step={0.1}
          onCommit={(v) => set('minVolumeRatio', v)}
        />

        {/* RSI range */}
        <RangeSetting
          label="RSI"
          low={merged.minRsi}
          high={merged.maxRsi}
          min={0}
          max={100}
          step={1}
          onCommit={(low, high) => {
            set('minRsi', low);
            set('maxRsi', high);
          }}
        />

        {/* Minimum score */}
        <NumberSetting
          label="Minimum score"
          value={merged.minScore}
          min={0}
          max={100}
          step={5}
          onCommit={(v) => set('minScore', v)}
        />

        {/* Patterns */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Patterns</span>
          <CheckboxGroup
            options={PATTERN_FILTERS}
            selected={merged.patterns}
            onToggle={(item) => toggleInArray('patterns', item)}
          />
        </div>

        {/* Strategies */}
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">Strategies</span>
          <CheckboxGroup
            options={STRATEGY_FILTERS}
            selected={merged.strategies}
            onToggle={(item) => toggleInArray('strategies', item)}
          />
        </div>

        {/* Min Risk/Reward */}
        <NumberSetting
          label="Min R:R"
          value={merged.minRiskReward}
          min={1}
          max={5}
          step={0.1}
          onCommit={(v) => set('minRiskReward', v)}
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
