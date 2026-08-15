import type { Metadata } from 'next';
import { ScreenerPatterns } from '@/features/dashboard/screener-patterns';

export const metadata: Metadata = {
  title: 'Screener · Patterns',
};

export default function ScreenerPatternsPage() {
  return <ScreenerPatterns />;
}
