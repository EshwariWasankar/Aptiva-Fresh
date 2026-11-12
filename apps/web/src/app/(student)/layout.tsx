'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { useSession } from '../../lib/session';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/onboarding/diagnostic', label: 'Diagnostic' },
  { href: '/plan', label: 'Plan' },
  { href: '/practice', label: 'Practice' },
  { href: '/reassessment', label: 'Reassessment' },
  { href: '/notebook', label: 'Notebook' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

function StudentNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-900 text-slate-100 shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
            A
          </span>
          Aptiva
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active
                    ? 'bg-slate-800 font-medium text-white'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="ml-3 hidden text-xs text-slate-400 lg:inline">{user?.email}</span>
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = '/login'))}
            className="ml-2 rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-100"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <StudentNav />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </RequireAuth>
  );
}
