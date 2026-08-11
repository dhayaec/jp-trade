import type { Metadata } from 'next';
import { TradeLog } from '@/features/dashboard/trade-log';

export const metadata: Metadata = { title: 'Trade Log' };

export default function TradeLogPage() {
  return <TradeLog />;
}
