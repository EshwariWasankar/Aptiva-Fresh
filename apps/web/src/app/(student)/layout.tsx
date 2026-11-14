'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
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
  IconSliders,
  IconBell,
  IconChevronDown,
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

const LEFT_DOCK = [
  { href: '/dashboard', label: 'Overview', icon: IconHome },
  { href: '/plan', label: 'Study Plan', icon: IconCalendar },
  { href: '/practice', label: 'Practice Drills', icon: IconTarget },
  { href: '/reassessment', label: 'Readiness', icon: IconActivity },
];

function StudentNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [glassMenuOpen, setGlassMenuOpen] = useState(false);
  const [glassMode, setGlassMode] = useState<'warm' | 'frost' | 'crisp'>('warm');

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'A';

  const applyGlassPreset = (preset: 'warm' | 'frost' | 'crisp') => {
    setGlassMode(preset);
    setGlassMenuOpen(false);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (preset === 'frost') {
        root.style.setProperty('--glass-blur', '36px');
        root.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.65)');
      } else if (preset === 'crisp') {
        root.style.setProperty('--glass-blur', '14px');
        root.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.42)');
      } else {
        root.style.setProperty('--glass-blur', '28px');
        root.style.setProperty('--surface-glass', 'rgba(255, 255, 255, 0.55)');
      }
    }
  };

  return (
    <>
      {/* Top Floating Glass Header Bar (Matching Reference Screenshot) */}
      <header className="sticky top-4 z-40 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="glass-header flex items-center justify-between px-5 py-3">
          {/* Brand Logo, Workspace Context & Assessment Selector */}
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

            <span className="hidden text-xs text-stone-300 md:inline">|</span>

            {/* Assessment Selector Pill */}
            <Link
              href="/setup/requirements"
              className="hidden md:flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-stone-700 border border-stone-200/60 hover:bg-white hover:text-stone-900 transition-colors shadow-2xs"
              title="Change Assessment Target"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              <span>GMAT Focus Edition</span>
              <IconChevronDown className="w-3.5 h-3.5 text-stone-400" />
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

          {/* Right Controls: Adjust Glass, Notification Bell, User Avatar, Sign Out */}
          <div className="flex items-center gap-2.5">
            {/* Interactive "Adjust glass" feature matching reference screenshot */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGlassMenuOpen(!glassMenuOpen)}
                className="flex items-center gap-1.5 rounded-full bg-white/70 hover:bg-white px-3 py-1 text-xs font-medium text-stone-700 border border-stone-200/60 transition-colors shadow-2xs"
                title="Adjust glass refraction and blur"
              >
                <IconSliders className="w-3.5 h-3.5 text-stone-500" />
                <span className="hidden sm:inline">Adjust glass</span>
              </button>

              {glassMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl glass-card p-3 shadow-xl border border-white/90 z-50 flex flex-col gap-1.5 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 font-semibold text-stone-800 border-b border-stone-100 text-[11px] uppercase tracking-wider">
                    Glass Presets
                  </div>
                  <button
                    type="button"
                    onClick={() => applyGlassPreset('warm')}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition ${
                      glassMode === 'warm'
                        ? 'bg-stone-900 text-white font-medium'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>Warm Glow</span>
                    {glassMode === 'warm' && <span className="text-[10px]">Active</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlassPreset('frost')}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition ${
                      glassMode === 'frost'
                        ? 'bg-stone-900 text-white font-medium'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>Deep Acrylic</span>
                    {glassMode === 'frost' && <span className="text-[10px]">Active</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlassPreset('crisp')}
                    className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left transition ${
                      glassMode === 'crisp'
                        ? 'bg-stone-900 text-white font-medium'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>Crisp Minimal</span>
                    {glassMode === 'crisp' && <span className="text-[10px]">Active</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 border border-stone-200/60 text-stone-600 hover:text-stone-900 hover:bg-white transition-colors shadow-2xs"
            >
              <IconBell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>

            {/* Profile Avatar */}
            <Link
              href="/profile"
              className="flex items-center gap-2 group"
              title={user?.email || 'Profile'}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 border border-stone-300/70 text-xs font-semibold text-stone-800 shadow-2xs group-hover:border-stone-400 transition-colors">
                {userInitial}
              </div>
            </Link>

            {/* Sign Out Button */}
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

      {/* Floating Left Vertical Dock (Directly from the Reference Screenshot) */}
      <aside
        aria-label="Sidebar Dock Navigation"
        className="fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 p-2 rounded-2xl glass-pill shadow-xl border border-white/80"
      >
        {LEFT_DOCK.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                active
                  ? 'bg-white shadow-sm text-stone-900 border border-stone-200/50'
                  : 'text-stone-500 hover:bg-white/60 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-stone-500'}`} />
            </Link>
          );
        })}
      </aside>

      {/* Floating Bottom Navigation Dock (Inspired by Reference Screenshot) */}
      <aside
        aria-label="Bottom Dock Navigation"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[94vw]"
      >
        <div className="glass-pill flex items-center gap-1.5 p-1.5 shadow-xl border border-white/80 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
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
