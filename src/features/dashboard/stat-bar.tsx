import { cn } from '@/lib/utils';

/**
 * A single labeled component score — e.g. `Vol 22/30` — rendered as a compact
 * label + horizontal bar. Used inside the row breakdown (screener) and the
 * detail-page score breakdown panel.
 */
export function StatBar({
  score,
  label,
  max = 100,
  className,
}: {
  score: number;
  label: string;
  /** Denominator shown next to the label. Defaults to `100`. */
  max?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div className={cn('w-16', className)}>
      <div className="mb-0.5 flex items-baseline justify-between gap-1 text-[11px]">
        <span className="font-medium text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-500">
          {Math.round(score)}
          {max !== 100 && <span className="text-slate-600">/{max}</span>}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
