'use client';

import { useEffect } from 'react';

/**
 * Dashboard error boundary. Catches render errors originating from the
 * dashboard page tree while preserving the rest of the application shell.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-rose-500/30 bg-slate-900/60 p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Dashboard failed to load</h2>
        <p className="mt-2 text-sm text-slate-400">
          Could not render the trading dashboard. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg bg-indigo-500/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
