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
  { href: '/billing', label: 'Billing', fullLabel: 'Subscription Passes', icon: IconCreditCard },
  { href: '/settings', label: 'Settings', fullLabel: 'Settings', icon: IconSettings },
];

const LEFT_DOCK = [
  { href: '/dashboard', label: 'Overview', icon: IconHome },
  { href: '/plan', label: 'Study Plan', icon: IconCalendar },
  { href: '/practice', label: 'Practice Drills', icon: IconTarget },
  { href: '/reassessment', label: 'Readiness', icon: IconActivity },
  { href: '/billing', label: 'Plans & Passes', icon: IconCreditCard },
];

function StudentNav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
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
    <>
      {/* Dark Navy Floating Glass Header (Approved Figma Design) */}
      <header className="sticky top-4 z-40 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="navy-glass-header flex items-center justify-between px-5 py-3">
          {/* Brand Logo, Assessment Selector */}
          <div className="flex items-center gap-3.5">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition-transform group-hover:scale-105">
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
              <span className="text-base font-semibold tracking-tight text-white">Aptiva</span>
            </Link>

            <span className="hidden text-xs text-slate-600 sm:inline">|</span>

            {/* Assessment Target Selector */}
            <Link
              href="/setup/requirements"
              className="hidden sm:flex items-center gap-2 rounded-full bg-slate-800/90 px-3 py-1 text-xs font-medium text-slate-200 border border-slate-700/70 hover:bg-slate-700/80 hover:text-white transition-colors"
              title="Assessment Target & Requirements"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
              <span>GMAT Focus Edition</span>
              <IconChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>

          {/* Desktop Quick Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
            {NAV.slice(0, 6).map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 transition-all ${
                    active
                      ? 'bg-purple-200 text-purple-950 font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  {item.fullLabel}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Notifications, Profile, Sign Out */}
          <div className="flex items-center gap-3">
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
                        <span className="rounded-full bg-purple-100 text-purple-900 px-2 py-0.2 text-[10px]">
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
              <span className="hidden text-xs text-slate-300 md:inline font-medium group-hover:text-white transition-colors">
                {user?.email}
              </span>
            </Link>

            {/* Sign Out Action */}
            <button
              type="button"
              onClick={() => void signOut().then(() => (window.location.href = '/login'))}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Floating Left Vertical Dock (Desktop) */}
      <aside
        aria-label="Sidebar Dock Navigation"
        className="fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 p-2 rounded-2xl navy-glass-dock shadow-2xl border border-slate-700/50"
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
                  ? 'navy-dock-active'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </aside>

      {/* Dark Navy Floating Bottom Navigation Dock */}
      <aside
        aria-label="Bottom Dock Navigation"
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[94vw]"
      >
        <div className="navy-glass-dock flex items-center gap-1.5 p-1.5 shadow-2xl border border-slate-700/50 overflow-x-auto no-scrollbar">
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
                    ? 'navy-dock-active'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-purple-950' : 'text-slate-400'}`} />
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
