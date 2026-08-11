import type { Metadata } from 'next';
import { Dashboard } from '@/features/dashboard/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Dashboard page — Server Component shell.  The interactive panel
 * (`<Dashboard />`) is a Client Component that fetches on mount so that E2E
 * tests can intercept the API calls without a database.
 */
export default function DashboardPage() {
  return <Dashboard />;
}
