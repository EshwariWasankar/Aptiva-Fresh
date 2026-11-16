'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getNotificationPreferences,
  getNotifications,
  getWeeklySummary,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
  type NotificationItem,
  type NotificationPreferencesDto,
  type WeeklySummaryResponse,
} from '../../../lib/notifications';
import { IconBell, IconSparkles } from '../../../components/Icons';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferencesDto>({
    optInReminders: false,
    optInWeeklySummary: false,
    dailyLimit: 1,
    preferredHourUtc: 14,
  });
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummaryResponse | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getNotifications().then((res) => {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      }),
      getNotificationPreferences().then(setPrefs),
      getWeeklySummary().then(setWeeklySummary),
    ])
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const handleMarkRead = async (id: string) => {
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

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    setMsg(null);
    try {
      const updated = await updateNotificationPreferences(prefs);
      setPrefs(updated);
      setMsg('Notification preferences saved successfully.');
    } catch {
      setMsg('Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-purple-100/60 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700">
              <IconBell className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Notifications &amp; Reminders
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Study alerts, weekly progress recaps, and personalized practice reminders.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="btn-secondary self-start sm:self-auto py-1.5 px-3.5 text-xs font-semibold"
          >
            Mark all as read
          </button>
        )}
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 text-xs font-medium text-emerald-900">
          ✓ {msg}
        </div>
      )}

      {/* Notifications List */}
      <section className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-purple-50 pb-3">
          <h2 className="text-sm font-bold text-slate-900">
            Recent Alerts ({notifications.length})
          </h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-purple-100 text-purple-900 px-2.5 py-0.5 text-xs font-semibold">
              {unreadCount} unread
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            No notifications right now. You are completely up to date!
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-purple-50">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`py-3.5 px-2 flex items-start justify-between gap-4 rounded-xl transition ${
                  item.read ? 'opacity-85' : 'bg-purple-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      item.read ? 'bg-transparent' : 'bg-purple-600 ring-2 ring-purple-200'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900">{item.title}</h3>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.message}</p>
                    {item.link && (
                      <Link
                        href={item.link}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900 transition"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                </div>

                {!item.read && (
                  <button
                    type="button"
                    onClick={() => void handleMarkRead(item.id)}
                    className="text-[11px] font-medium text-slate-400 hover:text-purple-700 whitespace-nowrap"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly Summary Preview (FR-028) */}
      {weeklySummary && (
        <section className="glass-card p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-purple-100 text-purple-700">
              <IconSparkles className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Weekly Performance Summary</h2>
          </div>

          <div className="rounded-xl bg-purple-50/50 p-4 border border-purple-100/70 flex flex-col gap-2">
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              {weeklySummary.message}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span>
                Period: {weeklySummary.periodStart} to {weeklySummary.periodEnd}
              </span>
              <span>·</span>
              <span>Active days: {weeklySummary.activeDaysCount}</span>
              <span>·</span>
              <span>Questions: {weeklySummary.totalQuestions}</span>
              <span>·</span>
              <span>Duration: {weeklySummary.activeMinutes} mins</span>
            </div>
          </div>
        </section>
      )}

      {/* Notification Preferences & Reminder Settings */}
      <section className="glass-card p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Notification &amp; Reminder Settings
          </h2>
          <p className="text-xs text-slate-500">
            Control automated study reminders and weekly email recaps. No spam, ever.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex items-start gap-3 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.optInReminders ?? false}
              onChange={(e) => setPrefs({ ...prefs, optInReminders: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <span className="font-semibold text-slate-900">Daily Study Reminders</span>
              <p className="text-slate-500 mt-0.5">
                Receive a reminder to complete your scheduled practice blocks on planned study days.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.optInWeeklySummary ?? false}
              onChange={(e) => setPrefs({ ...prefs, optInWeeklySummary: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <div>
              <span className="font-semibold text-slate-900">Weekly Progress Summary</span>
              <p className="text-slate-500 mt-0.5">
                Receive an encouraging zero-guilt summary of your weekly questions, accuracy, and
                streak.
              </p>
            </div>
          </label>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Daily Reminders
              </label>
              <select
                value={prefs.dailyLimit ?? 1}
                onChange={(e) =>
                  setPrefs({ ...prefs, dailyLimit: Number.parseInt(e.target.value, 10) })
                }
                className="glass-input w-full py-2 px-3 text-xs"
              >
                <option value={1}>1 notification per day (Recommended)</option>
                <option value={2}>2 notifications per day</option>
                <option value={3}>3 notifications per day (Max)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Preferred Reminder Time (UTC Hour)
              </label>
              <select
                value={prefs.preferredHourUtc ?? 14}
                onChange={(e) =>
                  setPrefs({ ...prefs, preferredHourUtc: Number.parseInt(e.target.value, 10) })
                }
                className="glass-input w-full py-2 px-3 text-xs"
              >
                <option value={9}>09:00 UTC (Early Afternoon IST)</option>
                <option value={12}>12:00 UTC (Evening IST)</option>
                <option value={14}>14:00 UTC (Prime Study Time ~7:30 PM IST)</option>
                <option value={16}>16:00 UTC (Late Evening IST)</option>
                <option value={18}>18:00 UTC (Night IST)</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSavePrefs()}
          disabled={savingPrefs}
          className="btn-primary w-fit py-2 px-5 text-xs font-semibold disabled:opacity-50 mt-1"
        >
          {savingPrefs ? 'Saving…' : 'Save notification preferences'}
        </button>
      </section>
    </div>
  );
}
