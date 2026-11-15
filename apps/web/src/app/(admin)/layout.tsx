'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { useSession } from '../../lib/session';

const NAV: { href: string; label: string; roles: string[] }[] = [
  { href: '/admin', label: 'Overview', roles: ['admin', 'reviewer'] },
  { href: '/admin/questions', label: 'Questions', roles: ['admin', 'reviewer'] },
  { href: '/admin/import', label: 'Import', roles: ['admin'] },
  { href: '/admin/blueprints', label: 'Blueprints', roles: ['admin'] },
  { href: '/admin/review', label: 'Review', roles: ['admin', 'reviewer'] },
];

function AdminNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const items = NAV.filter((n) => user && n.roles.includes(user.role));
  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'A';

  return (
    <header className="sticky top-4 z-40 mx-auto max-w-7xl px-4 sm:px-6">
      <div className="navy-glass-header flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-xs transition-transform group-hover:scale-105">
              A
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">Aptiva Admin</span>
              <span className="rounded-full bg-purple-900/60 border border-purple-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                {user?.role}
              </span>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-1 text-xs font-medium">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 transition-all ${
                  active
                    ? 'bg-purple-200 text-purple-950 font-semibold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-300 md:inline font-medium">{user?.email}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-semibold text-white shadow-inner">
            {userInitial}
          </div>
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = '/login'))}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth role={['admin', 'reviewer']}>
      <div className="min-h-screen pb-20 pt-2">
        <AdminNav />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="glass-sheet p-6 sm:p-8 md:p-10">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
