import type { Metadata } from 'next';
import { SignalHistory } from '@/features/dashboard/signal-history';

export const metadata: Metadata = {
  title: 'Signal History',
};

export default function SignalHistoryPage() {
  return <SignalHistory />;
}
