import type { Metadata } from 'next';
import { ScreenerStrategies } from '@/features/dashboard/screener-strategies';

export const metadata: Metadata = {
  title: 'Screener · Strategies',
};

export default function ScreenerStrategiesPage() {
  return <ScreenerStrategies />;
}
