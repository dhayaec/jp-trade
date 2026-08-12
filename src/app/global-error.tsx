'use client';

import { useEffect } from 'react';

/**
 * Global error boundary. Catches errors in the root layout itself — the
 * normal `error.tsx` cannot catch these because the layout wraps them.
 * Must render its own `<html>` and `<body>` since the root layout is
 * unavailable when this boundary is active.
 */
export default function GlobalError({
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen items-center justify-center">
          <div className="max-w-md rounded-xl border border-rose-500/30 bg-slate-900/60 p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-100">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-400">
              A critical error occurred while loading the application.
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
      </body>
    </html>
  );
}
