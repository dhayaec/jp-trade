'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { History, LayoutDashboard, ScanLine, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/screener', label: 'Screener', icon: ScanLine },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trade-log', label: 'Trade Log', icon: History },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-slate-800 bg-slate-900/60 md:w-56">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2 border-b border-slate-800 px-4 transition-colors hover:bg-slate-800/50"
      >
        <TrendingUp className="h-6 w-6 text-indigo-400" />
        <span className="hidden text-lg font-bold tracking-tight text-slate-100 md:inline">
          JP Trade
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 pt-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-4 py-3">
        <p className="text-[11px] text-slate-600">v0.1.0 · NSE</p>
      </div>
    </aside>
  );
}
