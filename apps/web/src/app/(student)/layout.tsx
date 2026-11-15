'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { RequireAuth } from '../../components/RequireAuth';
import { useSession } from '../../lib/session';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../lib/notifications';
import {
  IconHome,
  IconCompass,
  IconCalendar,
  IconTarget,
  IconActivity,
  IconBook,
  IconUser,
  IconSettings,
  IconBell,
  IconChevronDown,
  IconCreditCard,
  IconMenu,
  IconX,
} from '../../components/Icons';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: IconHome },
  { href: '/plan', label: 'Study Plan', icon: IconCalendar },
  { href: '/practice', label: 'Practice', icon: IconTarget },
  { href: '/onboarding/diagnostic', label: 'Diagnostic', icon: IconCompass },
  { href: '/reassessment', label: 'Readiness', icon: IconActivity },
  { href: '/notebook', label: 'Notebook', icon: IconBook },
  { href: '/billing', label: 'Billing', icon: IconCreditCard },
  { href: '/profile', label: 'Profile', icon: IconUser },
  { href: '/settings', label: 'Settings', icon: IconSettings },
];

function StudentNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'A';

  const loadNotifications = () => {
    getNotifications()
      .then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu when navigating
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-3 z-40 mx-auto max-w-[1440px] px-3 sm:px-6">
      {/* Single Unified Academic Masthead in Deep Oxford Ink */}
      <div className="navy-glass-header flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 shadow-xl">
        {/* Left: Brand Logo & Assessment Target Selector */}
        <div className="flex items-center gap-3.5">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-900 text-sm font-semibold text-white shadow-md shadow-indigo-950/40 border border-indigo-400/30 transition-transform group-hover:scale-105">
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
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white leading-tight">
                Aptiva
              </span>
              <span className="text-[9px] uppercase tracking-widest text-indigo-300/80 font-mono -mt-0.5">
                Adaptive Prep
              </span>
            </div>
          </Link>

          <span className="hidden text-xs text-slate-700 sm:inline">|</span>

          {/* Assessment Target Selector */}
          <Link
            href="/setup/requirements"
            className="hidden sm:flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1 text-[11px] font-medium text-slate-200 border border-slate-700/80 hover:border-indigo-400/60 hover:text-white transition-all shadow-xs"
            title="Assessment Target & Requirements"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse"></span>
            <span className="truncate max-w-[150px] font-medium">Target: GMAT Focus</span>
            <IconChevronDown className="w-3 h-3 text-slate-400" />
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 transition-all text-xs ${
                  active
                    ? 'bg-indigo-100 text-indigo-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Notifications, Profile, Sign Out & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notification Bell with Live Unread Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors"
            >
              <IconBell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-card p-4 shadow-2xl border border-white z-50 flex flex-col gap-3 text-xs animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-purple-50 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-purple-100 text-purple-900 px-2 py-0.5 text-[10px]">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="text-[11px] font-medium text-purple-700 hover:text-purple-900"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No notifications right now.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                    {notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-xl border transition ${
                          n.read
                            ? 'bg-white/40 border-slate-100 text-slate-600'
                            : 'bg-purple-50/70 border-purple-100 text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold leading-tight">{n.title}</h4>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={(e) => void handleMarkRead(n.id, e)}
                              className="text-[10px] text-purple-700 hover:text-purple-900 shrink-0"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                          {n.message}
                        </p>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => setNotificationMenuOpen(false)}
                            className="mt-1.5 inline-block text-[11px] font-semibold text-purple-700 hover:underline"
                          >
                            Go to page →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-purple-50 pt-2 flex items-center justify-between">
                  <Link
                    href="/notifications"
                    onClick={() => setNotificationMenuOpen(false)}
                    className="text-xs font-semibold text-purple-700 hover:text-purple-900"
                  >
                    View all alerts &amp; settings →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setNotificationMenuOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar & Email */}
          <Link
            href="/profile"
            className="flex items-center gap-2 group"
            title="View Mastery Profile"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-semibold text-white shadow-sm ring-1 ring-white/20 transition-transform group-hover:scale-105">
              {userInitial}
            </div>
            <span className="hidden text-xs text-slate-300 xl:inline font-medium group-hover:text-white transition-colors truncate max-w-[120px]">
              {user?.email}
            </span>
          </Link>

          {/* Sign Out Action */}
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = '/login'))}
            className="hidden sm:inline-block rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
          >
            Sign out
          </button>

          {/* Mobile/Tablet Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors"
          >
            {mobileMenuOpen ? <IconX className="w-4 h-4" /> : <IconMenu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden mt-2 rounded-2xl navy-glass-header p-3 shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 text-xs"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-2 border-b border-slate-800">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    active
                      ? 'bg-purple-200 text-purple-950 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-purple-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="truncate max-w-[200px]">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut().then(() => (window.location.href = '/login'))}
              className="text-rose-400 hover:text-rose-300 font-medium"
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen pb-12 pt-1">
        <StudentNav />
        <main className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="glass-sheet p-5 sm:p-8 lg:p-10">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
