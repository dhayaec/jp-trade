import type { Metadata } from 'next';
import { ScreenerTechnical } from '@/features/dashboard/screener-technical';

export const metadata: Metadata = {
  title: 'Screener · Technical',
};

export default function ScreenerTechnicalPage() {
  return <ScreenerTechnical />;
}
