'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  History,
  LayoutDashboard,
  ScanLine,
  Settings,
  Star,
  TrendingUp,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const LINKS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/screener',
    label: 'Screener',
    icon: ScanLine,
    children: [
      { href: '/screener/live', label: 'Live', icon: Zap },
      { href: '/screener/technical', label: 'Technical', icon: ScanLine },
      { href: '/screener/patterns', label: 'Patterns', icon: Zap },
      { href: '/screener/strategies', label: 'Strategies', icon: TrendingUp },
    ],
  },
  { href: '/signals', label: 'Signals', icon: Zap },
  { href: '/signal-history', label: 'Signal History', icon: Clock },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/backtest', label: 'Backtest', icon: TrendingUp },
  { href: '/trade-log', label: 'Trade Log', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  const isActive = (href: string) => pathname.startsWith(href);
  const isChildActive = (children: NavItem[]) => children.some((c) => isActive(c.href));
  const isParentActive = (item: NavItem) =>
    isActive(item.href) || (item.children && isChildActive(item.children));

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
        {LINKS.map((item) => {
          const active = isParentActive(item);
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            return (
              <div key={item.href} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === item.href ? null : item.href))}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="hidden md:inline truncate">{item.label}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                      expanded === item.href && 'rotate-180'
                    )}
                  />
                </button>
                {expanded === item.href && item.children && (
                  <div className="ml-8 space-y-0.5 pl-2 border-l border-slate-800/50">
                    {item.children.map((child) => {
                      const childActive = isActive(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                            childActive
                              ? 'bg-indigo-500/10 text-indigo-300'
                              : 'text-slate-500 hover:bg-slate-800/50 hover:text-slate-300'
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden md:inline">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
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
