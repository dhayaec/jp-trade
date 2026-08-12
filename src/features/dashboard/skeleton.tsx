import { cn } from '@/lib/utils';

/** Animated placeholder block used while data is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-800/60', className)} />;
}
