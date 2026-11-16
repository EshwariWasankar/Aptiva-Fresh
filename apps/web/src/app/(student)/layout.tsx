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
      {/* Single Unified Academic Masthead in Deep Teal ("The Performance Lab") */}
      <div className="navy-glass-header flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-2.5 sm:py-3 shadow-xl">
        {/* Left: Brand Logo & Assessment Target Selector */}
        <div className="flex items-center gap-3 sm:gap-3.5 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#174c4b] via-[#1b5756] to-[#252d2d] text-sm font-semibold text-[#c1d16b] shadow-md shadow-[#174c4b]/40 border border-[#9daeac]/30 transition-transform group-hover:scale-105">
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
              <span className="text-[9px] uppercase tracking-widest text-[#c1d16b] font-mono -mt-0.5">
                Adaptive Prep
              </span>
            </div>
          </Link>

          <span className="hidden text-xs text-[#9daeac]/40 sm:inline">|</span>

          {/* Assessment Target Selector */}
          <Link
            href="/setup/requirements"
            className="hidden sm:flex items-center gap-2 rounded-full bg-[#123c3b]/90 px-3 py-1 text-[11px] font-medium text-slate-100 border border-[#9daeac]/30 hover:border-[#c1d16b]/60 hover:text-white transition-all shadow-xs shrink-0"
            title="Assessment Target & Requirements"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#c1d16b] ring-2 ring-[#c1d16b]/40 animate-pulse"></span>
            <span className="truncate max-w-[150px] font-medium">Target: GMAT Focus</span>
            <IconChevronDown className="w-3 h-3 text-[#9daeac]" />
          </Link>

          {/* Distinct structural divider separating Target Selector from Navigation */}
          <span
            className="hidden lg:inline-block h-4 w-px bg-[#9daeac]/20 shrink-0 ml-1"
            aria-hidden="true"
          />
        </div>

        {/* Center: Desktop Navigation Bar with Chartreuse Active Pills */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium shrink min-w-0 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-2.5 xl:px-3 py-1.5 transition-all text-xs whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#c1d16b] text-[#252d2d] font-bold shadow-xs'
                    : 'text-slate-200 hover:bg-[#123c3b] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls: Notifications, Profile, Sign Out & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Notification Bell with Live Unread Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationMenuOpen(!notificationMenuOpen)}
              aria-label="Notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#123c3b]/80 border border-[#9daeac]/30 text-slate-200 hover:text-white hover:bg-[#123c3b] transition-colors"
            >
              <IconBell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c1d16b] px-1 text-[10px] font-bold text-[#252d2d] ring-2 ring-[#174c4b] font-mono">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass-card p-4 shadow-2xl border border-white z-50 flex flex-col gap-3 text-xs animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-[#f5f9dc] text-[#37420c] border border-[#c1d16b] px-2 py-0.5 text-[10px] font-mono font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="text-[11px] font-medium text-[#174c4b] hover:underline"
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
                            ? 'bg-white/40 border-stone-100 text-slate-600'
                            : 'bg-[#f5f9dc]/70 border-[#c1d16b]/50 text-slate-900 font-medium'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold leading-tight">{n.title}</h4>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={(e) => void handleMarkRead(n.id, e)}
                              className="text-[10px] text-[#174c4b] hover:underline shrink-0"
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
                            className="mt-1.5 inline-block text-[11px] font-semibold text-[#174c4b] hover:underline"
                          >
                            Go to page →
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-stone-100 pt-2 flex items-center justify-between">
                  <Link
                    href="/notifications"
                    onClick={() => setNotificationMenuOpen(false)}
                    className="text-xs font-semibold text-[#174c4b] hover:underline"
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

          {/* Admin Switcher for Admins & Reviewers */}
          {(user?.role === 'admin' || user?.role === 'reviewer') && (
            <Link
              href="/admin/questions"
              className="flex items-center gap-1.5 rounded-xl bg-[#123c3b] px-3 py-1.5 text-xs font-semibold text-[#c1d16b] shadow-md shadow-[#174c4b]/40 border border-[#c1d16b]/50 transition hover:bg-[#0f2e2d] hover:scale-105 shrink-0"
              title="Open Admin Portal & Question Bank"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Admin Portal</span>
            </Link>
          )}

          {/* Profile Avatar & Email */}
          <Link
            href="/profile"
            className="flex items-center gap-2 group"
            title="View Mastery Profile"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#123c3b] to-[#252d2d] text-xs font-bold text-[#c1d16b] shadow-sm ring-1 ring-[#9daeac]/40 transition-transform group-hover:scale-105">
              {userInitial}
            </div>
            <span className="hidden text-xs text-slate-200 xl:inline font-medium group-hover:text-white transition-colors truncate max-w-[120px]">
              {user?.email}
            </span>
          </Link>

          {/* Sign Out Action */}
          <button
            type="button"
            onClick={() => void signOut().then(() => (window.location.href = '/login'))}
            className="hidden sm:inline-block rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-[#123c3b] hover:text-white"
          >
            Sign out
          </button>

          {/* Mobile/Tablet Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-[#123c3b]/80 border border-[#9daeac]/30 text-slate-200 hover:text-white hover:bg-[#123c3b] transition-colors"
          >
            {mobileMenuOpen ? <IconX className="w-4 h-4" /> : <IconMenu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden mt-2 rounded-2xl navy-glass-header p-3 shadow-2xl border border-[#9daeac]/30 animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 text-xs"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pb-2 border-b border-[#9daeac]/20">
            {(user?.role === 'admin' || user?.role === 'reviewer') && (
              <Link
                href="/admin/questions"
                onClick={() => setMobileMenuOpen(false)}
                className="col-span-2 sm:col-span-3 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold bg-[#123c3b] text-[#c1d16b] shadow-md border border-[#c1d16b]/50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Open Admin Portal</span>
              </Link>
            )}
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
                      ? 'bg-[#c1d16b] text-[#252d2d] font-bold shadow-xs'
                      : 'text-slate-200 hover:bg-[#123c3b] hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[#252d2d]' : 'text-slate-300'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-300 px-2">
            <span className="truncate max-w-[200px]">{user?.email}</span>
            <button
              type="button"
              onClick={() => void signOut().then(() => (window.location.href = '/login'))}
              className="text-rose-300 hover:text-rose-200 font-medium"
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
