import type { Metadata } from 'next';
import { SettingsView } from '@/features/dashboard/settings-page';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return <SettingsView />;
}
