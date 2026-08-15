'use client';

import { cn } from '@/lib/utils';

interface SparklineProps {
  /** Array of data points (0-100). */
  data: readonly number[];
  /** Color theme for the line. */
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
  /** Height of the sparkline in pixels. */
  height?: number;
  /** Width of the sparkline in pixels (container width). */
  width?: number;
  /** Show area fill under the line. */
  fill?: boolean;
  /** Optional label to show as title. */
  label?: string;
  /** Optional current value to display. */
  currentValue?: number;
  /** Optional change indicator (e.g., "+12" or "-5"). */
  change?: string;
}

const COLORS = {
  indigo: 'stroke-indigo-400 fill-indigo-400/20',
  emerald: 'stroke-emerald-400 fill-emerald-400/20',
  amber: 'stroke-amber-400 fill-amber-400/20',
  rose: 'stroke-rose-400 fill-rose-400/20',
} as const;

export function Sparkline({
  data,
  color = 'indigo',
  height = 40,
  width,
  fill = true,
  label,
  currentValue,
  change,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <div className={cn('flex items-center gap-2', width && `w-${width}`)}>
        {label && <span className="text-xs font-medium text-slate-400">{label}</span>}
        <span className="text-xs text-slate-500">Insufficient data</span>
      </div>
    );
  }

  const clampedData = data.map((v) => Math.max(0, Math.min(100, v)));
  const minVal = Math.min(...clampedData);
  const maxVal = Math.max(...clampedData);
  const range = maxVal - minVal || 1; // avoid div/0
  const stepX = width ? width / (clampedData.length - 1) : undefined;

  // Build SVG path
  const points = clampedData.map((val, i) => {
    const x = stepX ? i * stepX : (i / (clampedData.length - 1)) * 100;
    const y = height - ((val - minVal) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const areaD = fill ? `${pathD} L${width || 100},${height} L0,${height} Z` : undefined;

  // Determine color based on trend - we know clampedData.length >= 2 here
  const lastVal = clampedData[clampedData.length - 1] as number;
  const firstVal = clampedData[0] as number;
  const isUp = lastVal >= firstVal;
  const dynamicColor = isUp ? 'emerald' : 'rose';
  const useColor = change ? dynamicColor : color;

  return (
    <div className={cn('flex items-end gap-2', width && `w-${width}`)}>
      {label && (
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-slate-400">{label}</span>
          {currentValue !== undefined && (
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-bold tabular-nums text-slate-100">{currentValue}</span>
              {change && (
                <span
                  className={cn(
                    'text-xs font-semibold',
                    change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                  )}
                >
                  {change}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <svg
        width={width ?? '100%'}
        height={height}
        viewBox={`0 0 ${width ?? 100} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {fill && areaD && (
          <path d={areaD} className={cn(COLORS[useColor], 'opacity-30')} stroke="none" />
        )}
        <path
          d={pathD}
          className={cn(COLORS[useColor], 'stroke-2')}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Current value dot */}
        <circle
          cx={width ?? 100}
          cy={height - ((lastVal - minVal) / range) * (height - 4) - 2}
          r="3"
          className={cn(COLORS[useColor].replace('stroke-', 'fill-').split(' ')[0])}
        />
      </svg>
    </div>
  );
}

/**
 * Calculate a simple trend summary from sparkline data.
 */
export function calculateTrend(data: readonly number[]): {
  change: number;
  changePct: number;
  direction: 'up' | 'down' | 'flat';
  sparkline: string; // Unicode sparkline for text fallback
} {
  if (data.length < 2) {
    return { change: 0, changePct: 0, direction: 'flat', sparkline: '��' };
  }

  const first = data[0] as number;
  const last = data[data.length - 1] as number;
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const direction = change > 1 ? 'up' : change < -1 ? 'down' : 'flat';

  // Unicode sparkline chars
  const ticks = '��������������█';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const sparkline = data
    .map((v) => ticks[Math.min(Math.floor(((v - min) / range) * ticks.length), ticks.length - 1)])
    .join('');

  return { change, changePct, direction, sparkline };
}
