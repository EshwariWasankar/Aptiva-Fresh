'use client';

import { useEffect, useState } from 'react';
import {
  deleteAccount,
  exportData,
  getPlanSettings,
  putPlanSettings,
  updateConsents,
} from '../../../lib/practice';
import { getCommitment, setCommitment, type CommitmentResponse } from '../../../lib/commitments';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferencesDto,
} from '../../../lib/notifications';
import { ApiError } from '../../../lib/apiClient';
import { PasswordInput } from '../../../components/PasswordInput';
import { IconBell, IconTarget } from '../../../components/Icons';

const PURPOSES = [
  { id: 'analytics', label: 'Anonymous usage analytics' },
  { id: 'marketing', label: 'Product updates and tips' },
  { id: 'support', label: 'Support communications' },
];

/** P-19 — account, plan settings, commitments, notification preferences, consents and data controls. */
export default function SettingsPage() {
  const [keepMyPlan, setKeepMyPlan] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Commitment state
  const [commitmentData, setCommitmentData] = useState<CommitmentResponse | null>(null);
  const [commType, setCommType] = useState<'days' | 'minutes'>('days');
  const [commTarget, setCommTarget] = useState<number>(5);
  const [commRestDays, setCommRestDays] = useState<number>(1);
  const [savingCommitment, setSavingCommitment] = useState(false);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferencesDto>({
    optInReminders: false,
    optInWeeklySummary: false,
    dailyLimit: 1,
    preferredHourUtc: 14,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  useEffect(() => {
    getPlanSettings()
      .then((r) => setKeepMyPlan(r.planSettings.keepMyPlan === true))
      .catch(() => undefined);

    getCommitment()
      .then((res) => {
        setCommitmentData(res);
        if (res.commitment) {
          setCommType(res.commitment.type);
          setCommTarget(res.commitment.target);
          setCommRestDays(res.commitment.restDaysAllowed);
        }
      })
      .catch(() => undefined);

    getNotificationPreferences()
      .then(setNotifPrefs)
      .catch(() => undefined);
  }, []);

  async function handleSaveCommitment() {
    setSavingCommitment(true);
    setError(null);
    try {
      const res = await setCommitment({
        type: commType,
        target: commTarget,
        restDaysAllowed: commRestDays,
      });
      setCommitmentData(res);
      setMsg('Study commitment saved successfully.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save commitment.');
    } finally {
      setSavingCommitment(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifs(true);
    setError(null);
    try {
      const updated = await updateNotificationPreferences(notifPrefs);
      setNotifPrefs(updated);
      setMsg('Notification preferences updated.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not update notification settings.');
    } finally {
      setSavingNotifs(false);
    }
  }

  async function savePlanSettings() {
    setBusy(true);
    setError(null);
    try {
      await putPlanSettings({ keepMyPlan });
      setMsg('Plan settings saved successfully.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleConsent(purpose: string, granted: boolean) {
    setConsents((c) => ({ ...c, [purpose]: granted }));
    try {
      await updateConsents([{ purpose, granted }]);
      setMsg('Consent updated.');
    } catch {
      setError('Could not update consent.');
    }
  }

  async function doExport() {
    setBusy(true);
    setError(null);
    try {
      const data = await exportData(password);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aptiva-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Export package downloaded.');
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export failed — check your password.');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (confirmDelete !== 'DELETE') {
      setError('Type DELETE to confirm.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await deleteAccount(password);
      setMsg(
        `Account scheduled for deletion on ${new Date(r.deletionAfter).toLocaleDateString()}. You will be signed out.`,
      );
      setTimeout(() => {
        window.location.href = '/login';
      }, 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not schedule deletion.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-purple-100/60 pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Account &amp; Study Settings
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl">
          Manage your daily study consistency, notification preferences, adaptive planner behavior,
          privacy consents, and personal data controls.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3.5 text-xs font-medium text-emerald-900">
          ✓ {msg}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Balanced Two-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column 1: Daily Study Habit & Adaptive Settings */}
        <div className="flex flex-col gap-6">
          {/* Study Commitments & Streak Goals (PH13-T04) */}
          <section className="bento-card p-6 flex flex-col gap-4 bg-white">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                  <IconTarget className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-900">
                  Study Commitment &amp; Rest Days
                </h2>
              </div>
              {commitmentData?.commitment && (
                <span className="rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-semibold font-mono">
                  Status: {commitmentData.commitment.status}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Set your consistency target without guilt. Planned rest days preserve your study
              streak when life gets busy.
            </p>

            {commitmentData?.evaluation && (
              <div className="rounded-xl bg-indigo-50/60 p-3.5 border border-indigo-100/70 text-xs text-indigo-950 font-medium">
                {commitmentData.evaluation.text}
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Type</label>
                <select
                  value={commType}
                  onChange={(e) => setCommType(e.target.value as 'days' | 'minutes')}
                  className="glass-input w-full py-2 px-3 text-xs"
                >
                  <option value="days">Active Days Goal</option>
                  <option value="minutes">Study Minutes Goal</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target {commType === 'days' ? 'Days' : 'Minutes'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={commType === 'days' ? 30 : 3000}
                  value={commTarget}
                  onChange={(e) => setCommTarget(Number.parseInt(e.target.value, 10) || 1)}
                  className="glass-input w-full py-2 px-3 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Allowed Rest Days</label>
                <select
                  value={commRestDays}
                  onChange={(e) => setCommRestDays(Number.parseInt(e.target.value, 10))}
                  className="glass-input w-full py-2 px-3 text-xs"
                >
                  <option value={0}>0 rest days (Strict)</option>
                  <option value={1}>1 rest day (Recommended)</option>
                  <option value={2}>2 rest days</option>
                  <option value={3}>3 rest days</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveCommitment()}
              disabled={savingCommitment}
              className="btn-primary w-fit py-2 px-4 text-xs font-semibold disabled:opacity-50 mt-1"
            >
              {savingCommitment ? 'Saving…' : 'Save study commitment'}
            </button>
          </section>

          {/* Notification & Reminder Preferences (FR-028) */}
          <section className="bento-card p-6 flex flex-col gap-4 bg-white">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                <IconBell className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Notification &amp; Reminder Preferences
              </h2>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.optInReminders ?? false}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, optInReminders: e.target.checked })
                  }
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900">Study Drill Reminders</span>
                  <p className="text-slate-500 mt-0.5">
                    Get notified when your daily personalized drill block is ready.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.optInWeeklySummary ?? false}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, optInWeeklySummary: e.target.checked })
                  }
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-900">Weekly Progress Recap</span>
                  <p className="text-slate-500 mt-0.5">
                    Receive weekly accuracy and streak recaps with zero guilt.
                  </p>
                </div>
              </label>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Daily Notification Limit
                  </label>
                  <select
                    value={notifPrefs.dailyLimit ?? 1}
                    onChange={(e) =>
                      setNotifPrefs({
                        ...notifPrefs,
                        dailyLimit: Number.parseInt(e.target.value, 10),
                      })
                    }
                    className="glass-input w-full py-2 px-3 text-xs"
                  >
                    <option value={1}>1 notification per day</option>
                    <option value={2}>2 notifications per day</option>
                    <option value={3}>3 notifications per day</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">
                    Preferred Delivery Hour
                  </label>
                  <select
                    value={notifPrefs.preferredHourUtc ?? 14}
                    onChange={(e) =>
                      setNotifPrefs({
                        ...notifPrefs,
                        preferredHourUtc: Number.parseInt(e.target.value, 10),
                      })
                    }
                    className="glass-input w-full py-2 px-3 text-xs"
                  >
                    <option value={9}>09:00 UTC (Afternoon)</option>
                    <option value={14}>14:00 UTC (Evening / Prime Study Time)</option>
                    <option value={17}>17:00 UTC (Night)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveNotifications()}
              disabled={savingNotifs}
              className="btn-primary w-fit py-2 px-4 text-xs font-semibold disabled:opacity-50 mt-1"
            >
              {savingNotifs ? 'Saving…' : 'Save notification settings'}
            </button>
          </section>

          {/* Plan Settings Card */}
          <section className="bento-card p-6 flex flex-col gap-3 bg-white">
            <h2 className="text-sm font-bold text-slate-900">Adaptive Planner Behavior</h2>
            <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={keepMyPlan}
                onChange={(e) => setKeepMyPlan(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-semibold text-slate-900">Keep my plan locked</span>
                <p className="mt-0.5 text-slate-500">
                  Don&apos;t automatically regenerate future days when finishing daily practice
                  drills.
                </p>
              </div>
            </label>
            <button
              type="button"
              onClick={() => void savePlanSettings()}
              disabled={busy}
              className="btn-primary w-fit mt-1 py-2 px-4 text-xs font-semibold disabled:opacity-50"
            >
              Save plan settings
            </button>
          </section>
        </div>

        {/* Column 2: Privacy, Data Controls & Account Lifecycle */}
        <div className="flex flex-col gap-6">
          {/* Consents Card */}
          <section className="bento-card p-6 flex flex-col gap-3 bg-white">
            <h2 className="text-sm font-bold text-slate-900">Privacy &amp; Data Consents</h2>
            <div className="flex flex-col gap-2.5">
              {PURPOSES.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={consents[p.id] ?? false}
                    onChange={(e) => void toggleConsent(p.id, e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-800">{p.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              Essential computation (scoring, Bayesian profile updating) cannot be switched off.
              Withdrawals take effect immediately.
            </p>
          </section>

          {/* Export Data Card */}
          <section className="bento-card p-6 flex flex-col gap-3 bg-white">
            <h2 className="text-sm font-bold text-slate-900">Your Data Export</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Export everything Aptiva stores about you: complete attempt logs, session histories,
              Bayesian topic snapshots, and requirements.
            </p>
            <div className="max-w-xs">
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
            </div>
            <button
              type="button"
              onClick={() => void doExport()}
              disabled={busy || !password}
              className="btn-secondary w-fit py-2 px-4 text-xs font-semibold disabled:opacity-40"
            >
              Download JSON export
            </button>
          </section>

          {/* Danger Zone: Delete Account */}
          <section className="rounded-2xl border border-rose-200/80 bg-rose-50/70 p-6 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-rose-950">Delete Account &amp; History</h2>
            <p className="text-xs text-rose-800 leading-relaxed">
              Deletion is scheduled 30 days in advance so you can change your mind if needed. All
              personal data, profiles, and logs are permanently wiped.
            </p>
            <div className="flex max-w-xs flex-col gap-2 mt-1">
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
              />
              <input
                type="text"
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="glass-input px-3.5 py-2 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => void doDelete()}
              disabled={busy || !password || confirmDelete !== 'DELETE'}
              className="w-fit rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-semibold py-2 px-4 text-xs transition-colors disabled:opacity-40"
            >
              Schedule account deletion
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
