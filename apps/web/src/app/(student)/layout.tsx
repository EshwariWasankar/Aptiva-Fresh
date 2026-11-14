'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { useSession } from '../../lib/session';
import {
  IconHome,
  IconCompass,
  IconCalendar,
  IconTarget,
  IconActivity,
  IconBook,
  IconUser,
  IconSettings,
} from '../../components/Icons';

const NAV = [
  { href: '/dashboard', label: 'Overview', fullLabel: 'Dashboard', icon: IconHome },
  { href: '/plan', label: 'Plan', fullLabel: 'Study Plan', icon: IconCalendar },
  { href: '/practice', label: 'Practice', fullLabel: 'Practice Drills', icon: IconTarget },
  {
    href: '/onboarding/diagnostic',
    label: 'Diagnostic',
    fullLabel: 'Diagnostic',
    icon: IconCompass,
  },
  { href: '/reassessment', label: 'Readiness', fullLabel: 'Reassessment', icon: IconActivity },
  { href: '/notebook', label: 'Notebook', fullLabel: 'Mistake Notebook', icon: IconBook },
  { href: '/profile', label: 'Profile', fullLabel: 'Mastery Profile', icon: IconUser },
  { href: '/settings', label: 'Settings', fullLabel: 'Settings', icon: IconSettings },
];

function StudentNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'A';

  return (
    <>
      {/* Top Floating Glass Header Bar */}
      <header className="sticky top-4 z-40 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="glass-header flex items-center justify-between px-5 py-3">
          {/* Brand Logo & Context */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-sm transition-transform group-hover:scale-105">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                  <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                  <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
                </svg>
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="text-base font-semibold tracking-tight text-stone-900">
                  Aptiva
                </span>
                <span className="hidden text-xs text-stone-400 sm:inline">|</span>
                <span className="hidden text-xs font-medium text-stone-500 sm:inline">
                  Placement workspace
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Top Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
            {NAV.slice(0, 5).map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 transition-all ${
                    active
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                  }`}
                >
                  {item.fullLabel}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-stone-500 md:inline font-medium">
              {user?.email}
            </span>
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200/80 border border-stone-300/60 text-xs font-semibold text-stone-700 shadow-inner"
              title={user?.email}
            >
              {userInitial}
            </div>
            <button
              type="button"
              onClick={() => void signOut().then(() => (window.location.href = '/login'))}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Floating Bottom Navigation Dock (Inspired by the Reference Screenshot) */}
      <aside
        aria-label="Bottom Dock Navigation"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[94vw]"
      >
        <div className="glass-pill flex items-center gap-1 p-1.5 shadow-xl border border-white/80 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'glass-pill-active font-semibold text-stone-900'
                    : 'text-stone-600 hover:bg-white/60 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-stone-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen pb-24 pt-2">
        <StudentNav />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="glass-sheet p-6 sm:p-8 md:p-10">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
