import type { Metadata } from 'next';
import { ScreenerWorkspace } from '@/features/dashboard/screener-workspace';

export const metadata: Metadata = {
  title: 'Screener',
};

/**
 * Stock Selection workspace — the primary entry point of the app.
 *
 * Server Component shell that renders the interactive `ScreenerWorkspace`
 * (filters, ranked list, score breakdowns, signal matrix).
 */
export default function ScreenerPage() {
  return <ScreenerWorkspace />;
}
