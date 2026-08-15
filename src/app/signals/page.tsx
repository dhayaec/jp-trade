import type { Metadata } from 'next';
import { SignalsPage as SignalsView } from '@/features/dashboard/signals-page';

export const metadata: Metadata = {
  title: 'Signals',
};

export default function SignalsPage() {
  return <SignalsView />;
}
