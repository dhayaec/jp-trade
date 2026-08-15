import type { Metadata } from 'next';
import { ScreenerWorkspace } from '@/features/dashboard/screener-workspace';

export const metadata: Metadata = {
  title: 'Screener · Live',
};

export default function ScreenerLivePage() {
  return <ScreenerWorkspace />;
}
