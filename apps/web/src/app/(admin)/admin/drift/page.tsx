'use client';

import { useEffect, useState } from 'react';
import {
  adminCreateDriftAlert,
  adminListDriftAlerts,
  adminListPatternReports,
  adminResolveDriftAlert,
  adminReviewPatternReport,
  type DriftAlert,
} from '../../../../lib/adminExtras';
import type { PatternReport } from '../../../../lib/patterns';

const SEVERITY_STYLE: Record<string, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-600',
};

export default function AdminDriftPage() {
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [reports, setReports] = useState<PatternReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    company: '',
    section: '',
    oldWeight: '',
    newWeight: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
    notes: '',
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminListDriftAlerts(), adminListPatternReports('pending')])
      .then(([a, r]) => {
        setAlerts(a);
        setReports(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const created = await adminCreateDriftAlert({
        company: form.company,
        section: form.section,
        oldWeight: Number(form.oldWeight),
        newWeight: Number(form.newWeight),
        severity: form.severity,
        ...(form.notes ? { notes: form.notes } : {}),
      });
      setAlerts((prev) => [created, ...prev]);
      setForm({
        company: '',
        section: '',
        oldWeight: '',
        newWeight: '',
        severity: 'medium',
        notes: '',
      });
      setShowForm(false);
      setMsg('Alert created.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function resolve(a: DriftAlert, status: 'resolved' | 'dismissed') {
    try {
      const updated = await adminResolveDriftAlert(a.id, { status });
      setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
    } catch {
      /* ignore */
    }
  }

  async function reviewReport(id: string, status: 'approved' | 'rejected') {
    try {
      await adminReviewPatternReport(id, status);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Blueprint drift alerts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Section-weight changes detected in company assessments that may need blueprint review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-[#174c4b] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {showForm ? 'Close' : 'New alert'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => void onSubmit(e)} className="bento-card flex flex-col gap-3 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Section (e.g. quantitative)"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            />
            <select
              value={form.severity}
              onChange={(e) =>
                setForm({ ...form, severity: e.target.value as typeof form.severity })
              }
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              required
              type="number"
              step="0.01"
              placeholder="Old weight"
              value={form.oldWeight}
              onChange={(e) => setForm({ ...form, oldWeight: e.target.value })}
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              step="0.01"
              placeholder="New weight"
              value={form.newWeight}
              onChange={(e) => setForm({ ...form, newWeight: e.target.value })}
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            />
            <input
              placeholder="Notes (opt)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-md border border-[#9daeac]/40 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-[#174c4b] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Create alert
            </button>
            {msg && <span className="text-xs text-slate-600">{msg}</span>}
          </div>
        </form>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="bento-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#9daeac]/30 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Weight change</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detected</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-b border-[#9daeac]/15 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{a.company}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.section}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                  {a.oldWeight} → {a.newWeight}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.medium}`}
                  >
                    {a.severity}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{a.status}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {new Date(a.detectedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {a.status === 'open' && (
                    <span className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => void resolve(a, 'resolved')}
                        className="text-xs text-green-700 underline"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolve(a, 'dismissed')}
                        className="text-xs text-slate-500 underline"
                      >
                        Dismiss
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {alerts.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                  No drift alerts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {reports.length > 0 && (
        <section className="bento-card overflow-hidden">
          <div className="border-b border-[#9daeac]/30 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Pending pattern reports ({reports.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#9daeac]/30 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-[#9daeac]/15 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.company}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.field}</td>
                  <td
                    className="max-w-xs truncate px-4 py-2.5 font-mono text-xs text-slate-500"
                    title={JSON.stringify(r.claim)}
                  >
                    {JSON.stringify(r.claim)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => void reviewReport(r.id, 'approved')}
                        className="text-xs text-green-700 underline"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewReport(r.id, 'rejected')}
                        className="text-xs text-red-600 underline"
                      >
                        Reject
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
