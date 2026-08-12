import { Skeleton } from '@/features/dashboard/skeleton';

/**
 * Trade log loading skeleton — shown by the React Suspense boundary while
 * the server component shell streams.
 */
export default function TradeLogLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40">
        {/* Header row */}
        <div className="grid grid-cols-9 gap-4 border-b border-slate-800 p-3">
          {['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'].map((k) => (
            <Skeleton key={k} className="h-3" />
          ))}
        </div>
        {/* Body rows */}
        {['r1', 'r2', 'r3', 'r4', 'r5'].map((row) => (
          <div key={row} className="grid grid-cols-9 gap-4 border-b border-slate-800/60 p-3">
            {['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'].map((k) => (
              <Skeleton key={k} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
