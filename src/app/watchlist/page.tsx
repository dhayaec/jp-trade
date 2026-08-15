import type { Metadata } from 'next';
import { WatchlistView } from '@/features/dashboard/watchlist-page';

export const metadata: Metadata = {
  title: 'Watchlist',
};

export default function WatchlistPage() {
  return <WatchlistView />;
}
