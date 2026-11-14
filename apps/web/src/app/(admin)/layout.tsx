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
      <div className="glass-header flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-xs">
              A
            </span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-stone-900">
                Aptiva Admin
              </span>
              <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-700">
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
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-stone-500 md:inline font-medium">{user?.email}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200/80 border border-stone-300/60 text-xs font-semibold text-stone-700">
            {userInitial}
          </div>
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = '/login'))}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-800 transition"
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
