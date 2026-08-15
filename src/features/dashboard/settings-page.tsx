'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Database, Bell, Shield, Palette, HardDrive, Save, RotateCcw } from 'lucide-react';

type SettingsState = 'saving' | 'saved' | 'idle' | 'error';

interface PersistedSettings {
  dataSource?: 'local' | 'supabase';
  notifications?: boolean;
  theme?: 'dark' | 'system';
}

/** Read settings from localStorage (SSR-safe: returns defaults on the server). */
function loadSettings(): PersistedSettings {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem('jp-trade-settings');
    return stored ? (JSON.parse(stored) as PersistedSettings) : {};
  } catch {
    return {};
  }
}

export function SettingsView() {
  // Lazy initializers read from localStorage during render — no sync setState in effect.
  const initial = loadSettings();
  const [dataSource, setDataSource] = useState<'local' | 'supabase'>(initial.dataSource ?? 'local');
  const [notifications, setNotifications] = useState(initial.notifications ?? true);
  const [theme, setTheme] = useState<'dark' | 'system'>(initial.theme ?? 'dark');
  const [state, setState] = useState<SettingsState>('idle');

  const handleSave = () => {
    setState('saving');
    try {
      const settings = { dataSource, notifications, theme };
      localStorage.setItem('jp-trade-settings', JSON.stringify(settings));
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('jp-trade-settings');
    setDataSource('local');
    setNotifications(true);
    setTheme('dark');
    setState('saved');
    setTimeout(() => setState('idle'), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
          <p className="text-sm text-slate-500">Manage application preferences</p>
        </div>
      </header>

      {/* Data Source */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Database className="h-4 w-4" />
          Data Source
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="dataSource"
              value="local"
              checked={dataSource === 'local'}
              onChange={() => setDataSource('local')}
              className="h-4 w-4 accent-indigo-500 border-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-slate-100">Local (SQLite/PostgreSQL)</p>
              <p className="text-xs text-slate-500">Uses local database via Prisma</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="dataSource"
              value="supabase"
              checked={dataSource === 'supabase'}
              onChange={() => setDataSource('supabase')}
              className="h-4 w-4 accent-indigo-500 border-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-slate-100">Supabase (Remote)</p>
              <p className="text-xs text-slate-500">Connects to Supabase PostgreSQL</p>
            </div>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Changing this requires setting the appropriate environment variables (
          <code className="bg-slate-800 px-1 rounded">DATABASE_URL</code> for local,
          <code className="bg-slate-800 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> for Supabase)
          and restarting the dev server.
        </p>
      </section>

      {/* Notifications */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Bell className="h-4 w-4" />
          Notifications
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={notifications}
            onChange={(e) => setNotifications(e.target.checked)}
            className="h-4 w-4 accent-indigo-500 border-slate-700 text-indigo-500 focus:ring-indigo-500"
          />
          <div>
            <p className="font-medium text-slate-100">Enable browser notifications</p>
            <p className="text-xs text-slate-500">
              Receive alerts for new signals, price alerts, and scan completions
            </p>
          </div>
        </label>
      </section>

      {/* Theme */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <Palette className="h-4 w-4" />
          Appearance
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={() => setTheme('dark')}
              className="h-4 w-4 accent-indigo-500 border-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-slate-100">Dark</p>
              <p className="text-xs text-slate-500">Always use dark mode</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === 'system'}
              onChange={() => setTheme('system')}
              className="h-4 w-4 accent-indigo-500 border-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            <div>
              <p className="font-medium text-slate-100">System</p>
              <p className="text-xs text-slate-500">Follow OS preference</p>
            </div>
          </label>
        </div>
      </section>

      {/* Storage */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
          <HardDrive className="h-4 w-4" />
          Local Storage
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          The app stores watchlist, scan history, and preferences in browser localStorage.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/15 text-rose-300 text-sm font-medium transition-colors hover:bg-rose-500/25"
          >
            <RotateCcw className="h-4 w-4" />
            Clear All Data
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This will remove your watchlist, scan timestamps, and saved preferences.
        </p>
      </section>

      {/* Save/Status */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <span
            className={cn('px-2 py-1 rounded text-xs font-medium', {
              'bg-emerald-500/15 text-emerald-300': state === 'saved',
              'bg-amber-500/15 text-amber-300': state === 'saving',
              'bg-slate-800 text-slate-400': state === 'idle',
              'bg-rose-500/15 text-rose-300': state === 'error',
            })}
          >
            {state === 'saved' && 'Saved'}
            {state === 'saving' && 'Saving...'}
            {state === 'idle' && 'Ready to save'}
            {state === 'error' && 'Error'}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={state === 'saving'}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            state === 'saving'
              ? 'bg-slate-800 text-slate-400'
              : 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
          )}
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>
      </div>

      {/* Version info */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center">
        <p className="text-xs text-slate-500">JP Trade v0.1.0 · NSE</p>
        <p className="mt-1 text-[10px] text-slate-600">
          Built with Next.js 16, React 19, TypeScript, Tailwind CSS, Prisma
        </p>
      </div>
    </div>
  );
}
