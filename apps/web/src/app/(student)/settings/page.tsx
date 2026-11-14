'use client';

import { useEffect, useState } from 'react';
import {
  deleteAccount,
  exportData,
  getPlanSettings,
  putPlanSettings,
  updateConsents,
} from '../../../lib/practice';
import { ApiError } from '../../../lib/apiClient';
import { PasswordInput } from '../../../components/PasswordInput';
// P-19 — account, plan settings, consents and data controls.

const PURPOSES = [
  { id: 'analytics', label: 'Anonymous usage analytics' },
  { id: 'marketing', label: 'Product updates and tips' },
  { id: 'support', label: 'Support communications' },
];

/** P-19 — account, plan settings, consents and data controls. */
export default function SettingsPage() {
  const [keepMyPlan, setKeepMyPlan] = useState(false);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPlanSettings()
      .then((r) => setKeepMyPlan(r.planSettings.keepMyPlan === true))
      .catch(() => undefined);
  }, []);

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="border-b border-stone-200/50 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Account &amp; Study Settings
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Manage planner behavior, privacy consents, full data export, and account lifecycle.
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

      {/* Plan Settings Card */}
      <section className="glass-card p-6 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-900">Adaptive Planner Behavior</h2>
        <label className="flex items-start gap-2.5 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={keepMyPlan}
            onChange={(e) => setKeepMyPlan(e.target.checked)}
            className="mt-0.5 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="font-semibold text-stone-900">Keep my plan locked</span>
            <p className="mt-0.5 text-stone-500">
              Don&apos;t automatically regenerate future days when finishing daily practice drills.
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

      {/* Consents Card */}
      <section className="glass-card p-6 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-900">Privacy &amp; Data Consents</h2>
        <div className="flex flex-col gap-2.5">
          {PURPOSES.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 text-xs text-stone-700">
              <input
                type="checkbox"
                checked={consents[p.id] ?? false}
                onChange={(e) => void toggleConsent(p.id, e.target.checked)}
                className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-stone-800">{p.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-stone-400">
          Essential computation (scoring, Bayesian profile updating) cannot be switched off.
          Withdrawals take effect immediately.
        </p>
      </section>

      {/* Export Data Card */}
      <section className="glass-card p-6 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-stone-900">Your Data Export</h2>
        <p className="text-xs text-stone-600 leading-relaxed">
          Export everything Aptiva stores about you: complete attempt logs, session histories,
          Bayesian topic snapshots, and requirements.
        </p>
        <div className="max-w-xs">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
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
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
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
  );
}
