import { Skeleton } from '@/features/dashboard/skeleton';

/**
 * Dashboard loading skeleton — shown by the React Suspense boundary while the
 * server component shell streams.  The interactive panel replaces this with
 * its own loading state on client mount.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Price chart placeholder */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <Skeleton className="mb-3 h-4 w-24" />
        <Skeleton className="h-64 w-full" />
      </section>

      {/* Patterns + Setups two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-28 w-full" />
        </section>
        <section className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-28 w-full" />
        </section>
      </div>

      {/* Screening table */}
      <section className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </section>
    </div>
  );
}
