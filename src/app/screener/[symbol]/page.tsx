import type { Metadata } from 'next';
import { ScreenerDetail } from '@/features/dashboard/screener-detail';

interface Props {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ timeframe?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { symbol } = await params;
  const { timeframe: _timeframe } = await searchParams;
  return {
    title: `${symbol} — Screener Detail`,
    description: `Evidence stack for ${symbol} including score breakdown, patterns, strategies, and risk/reward.`,
  };
}

/**
 * Stock detail page — Server Component shell.
 *
 * Fetches initial data on the server and renders the interactive
 * `ScreenerDetail` client component with all evidence panels.
 */
export default async function ScreenerDetailPage({ params, searchParams }: Props) {
  const { symbol } = await params;
  const { timeframe = '5m' } = await searchParams;

  return (
    <ScreenerDetail symbol={symbol} timeframe={timeframe as '1m' | '5m' | '15m' | '1h' | '1d'} />
  );
}
