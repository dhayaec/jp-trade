import type { Metadata } from 'next';
import { BacktestPage as BacktestView } from '@/features/dashboard/backtest-page';

export const metadata: Metadata = {
  title: 'Backtest',
};

export default function BacktestPage() {
  return <BacktestView />;
}
