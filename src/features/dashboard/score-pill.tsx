import { cn } from '@/lib/utils';

/**
 * Colored 0–100 score badge. Green ≥80, amber ≥60, slate otherwise — gives a
 * quick visual read on score quality before the user digs into the breakdown.
 */
export function ScorePill({ score, className }: { score: number; className?: string }) {
  const tone =
    score >= 80
      ? 'bg-emerald-500/15 text-emerald-300'
      : score >= 60
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-slate-500/15 text-slate-300';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 font-semibold tabular-nums',
        tone,
        className
      )}
    >
      {score}
    </span>
  );
}
