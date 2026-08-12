import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/features/dashboard/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'JP Trade',
    template: '%s | JP Trade',
  },
  description:
    'Japanese candlestick pattern recognition and NSE stock screening for smarter trades.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The nonce-based CSP applied in `src/proxy.ts` requires the document to be
  // rendered dynamically: Next.js only injects the per-request nonce into
  // inline scripts during SSR, not into statically pre-rendered HTML.
  await connection();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AppSidebar />
        <div className="pl-16 md:pl-56">
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
