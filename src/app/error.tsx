'use client';

import { useEffect } from 'react';

/**
 * Root route error boundary. Catches render errors in any page below the root
 * layout and offers a recovery action. The raw error is only logged — never
 * shown to the user.
 */
export default function ErrorBoundary({
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
        <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-400">
          An unexpected error occurred while rendering this page.
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
