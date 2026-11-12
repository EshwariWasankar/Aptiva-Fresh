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
      setMsg('Plan settings saved.');
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
      setMsg('Export downloaded.');
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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      {msg && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {msg}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <h2 className="font-semibold">Plan</h2>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepMyPlan}
            onChange={(e) => setKeepMyPlan(e.target.checked)}
          />
          Keep my plan — don&apos;t auto-regenerate after practice sessions
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          When off, finishing a session updates your profile and rebuilds future days.
        </p>
        <button
          type="button"
          onClick={() => void savePlanSettings()}
          disabled={busy}
          className="mt-3 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save plan settings
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <h2 className="font-semibold">Consents</h2>
        <div className="mt-3 flex flex-col gap-2">
          {PURPOSES.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consents[p.id] ?? false}
                onChange={(e) => void toggleConsent(p.id, e.target.checked)}
              />
              {p.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Essential processing (running the app) can&apos;t be switched off. Withdrawals are
          recorded immediately.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Export everything we store about you, or delete your account. Both require your password.
        </p>
        <div className="mt-3 max-w-xs">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={() => void doExport()}
            disabled={busy || !password}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
          >
            Download my data
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/50 p-5">
        <h2 className="font-semibold text-red-900">Delete account</h2>
        <p className="mt-1 text-sm text-red-800">
          Deletion is scheduled 30 days out so you can change your mind. All your data — profile,
          plans, attempts, sessions — is removed permanently when it executes.
        </p>
        <div className="mt-3 flex max-w-xs flex-col gap-2">
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          <input
            type="text"
            value={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void doDelete()}
          disabled={busy || !password || confirmDelete !== 'DELETE'}
          className="mt-3 rounded-md bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Schedule deletion
        </button>
      </section>
    </div>
  );
}
