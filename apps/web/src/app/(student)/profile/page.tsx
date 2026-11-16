'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  getProfile,
  getProfileHistory,
  type ProfileResponse,
  type ProfileSnapshotRow,
} from '../../../lib/profile';
import { ProfileRadar } from '../../../components/ProfileRadar';
import { TopicTable } from '../../../components/TopicTable';
import { StudyHeatmap } from '../../../components/StudyHeatmap';
import { getCommitmentActivity, type ActivityHistoryResponse } from '../../../lib/commitments';
import { IconCompass } from '../../../components/Icons';
import {
  createExternalScore,
  deleteExternalScore,
  listExternalScores,
  uploadScoresCsv,
  type ExternalScore,
} from '../../../lib/externalScores';
import { createPatternReport, listPatternReports, type PatternReport } from '../../../lib/patterns';

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [snapshots, setSnapshots] = useState<ProfileSnapshotRow[]>([]);
  const [activity, setActivity] = useState<ActivityHistoryResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [filterDays, setFilterDays] = useState(365);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ExternalScore[]>([]);
  const [reports, setReports] = useState<PatternReport[]>([]);
  const [scoreForm, setScoreForm] = useState({
    source: 'Manual',
    assessmentName: '',
    takenAt: '',
    totalScore: '',
    maxScore: '',
    percentile: '',
    notes: '',
  });
  const [scoreMsg, setScoreMsg] = useState<string | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({ company: '', field: 'numQuestions', claim: '' });
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'));
    getProfileHistory()
      .then((r) => setSnapshots(r.snapshots))
      .catch(() => undefined);
    getCommitmentActivity(365)
      .then(setActivity)
      .catch(() => undefined)
      .finally(() => setActivityLoading(false));
    listExternalScores()
      .then(setScores)
      .catch(() => undefined);
    listPatternReports()
      .then(setReports)
      .catch(() => undefined);
  }, []);

  const handleFilterChange = (days: number) => {
    setFilterDays(days);
    setActivityLoading(true);
    getCommitmentActivity(days)
      .then(setActivity)
      .catch(() => undefined)
      .finally(() => setActivityLoading(false));
  };

  async function addScore(e: React.FormEvent) {
    e.preventDefault();
    setScoreMsg(null);
    try {
      const created = await createExternalScore({
        source: scoreForm.source,
        assessmentName: scoreForm.assessmentName,
        takenAt: scoreForm.takenAt,
        totalScore: Number(scoreForm.totalScore),
        maxScore: Number(scoreForm.maxScore),
        ...(scoreForm.percentile ? { percentile: Number(scoreForm.percentile) } : {}),
        ...(scoreForm.notes ? { notes: scoreForm.notes } : {}),
      });
      setScores((prev) => [created, ...prev]);
      setScoreForm({
        source: 'Manual',
        assessmentName: '',
        takenAt: '',
        totalScore: '',
        maxScore: '',
        percentile: '',
        notes: '',
      });
      setScoreMsg('Score added.');
    } catch (err) {
      setScoreMsg(err instanceof Error ? err.message : 'Failed to add score');
    }
  }

  async function onCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvMsg(null);
    try {
      const res = await uploadScoresCsv(await file.text());
      setCsvMsg(`Imported ${res.imported ?? 0} score(s).`);
      listExternalScores()
        .then(setScores)
        .catch(() => undefined);
    } catch (err) {
      setCsvMsg(err instanceof Error ? err.message : 'CSV upload failed');
    }
  }

  async function removeScore(id: string) {
    try {
      await deleteExternalScore(id);
      setScores((prev) => prev.filter((x) => x.id !== id));
    } catch {
      /* keep row on failure */
    }
  }

  async function addReport(e: React.FormEvent) {
    e.preventDefault();
    setReportMsg(null);
    try {
      const claim = reportForm.claim.trim()
        ? (JSON.parse(reportForm.claim) as Record<string, unknown>)
        : { note: reportForm.claim || 'structural observation' };
      const created = await createPatternReport({
        company: reportForm.company,
        field: reportForm.field,
        claim,
      });
      setReports((prev) => [created, ...prev]);
      setReportForm({ company: '', field: 'numQuestions', claim: '' });
      setReportMsg('Report submitted for review.');
    } catch (err) {
      setReportMsg(err instanceof Error ? err.message : 'Failed to submit report');
    }
  }

  // Radar: mean rating per root section.
  const sectionMeans = useMemo(() => {
    if (!profile) return {};
    const sums = new Map<string, { total: number; n: number }>();
    for (const t of profile.topics) {
      const s = sums.get(t.sectionSlug) ?? { total: 0, n: 0 };
      s.total += t.rating;
      s.n += 1;
      sums.set(t.sectionSlug, s);
    }
    return Object.fromEntries([...sums.entries()].map(([k, v]) => [k, v.total / v.n]));
  }, [profile]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-[#9daeac]/30 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Mastery Profile
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Bayesian estimates calibrated across each aptitude section — updated after every drill and
          reassessment cycle.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}
      {!profile && !error && (
        <div className="glass-card p-12 text-center text-xs text-slate-400 border border-[#9daeac]/35">
          Loading mastery profile…
        </div>
      )}

      {profile && profile.topics.length === 0 && (
        <div className="glass-card p-10 text-center flex flex-col items-center gap-3 border border-[#9daeac]/35">
          <IconCompass className="w-8 h-8 text-slate-300" />
          <h2 className="text-base font-bold text-slate-800">No diagnostic data calibrated yet</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Take the initial setup diagnostic to establish your precision mastery baseline.
          </p>
          <Link
            href="/onboarding/diagnostic"
            className="btn-primary mt-2 py-2 px-5 text-xs font-semibold"
          >
            Take setup diagnostic →
          </Link>
        </div>
      )}

      {profile && profile.topics.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-[340px_1fr]">
            <div className="bento-card p-6 flex flex-col justify-between bg-white border border-[#9daeac]/35">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Section Mastery Radar
              </h2>
              <div className="flex justify-center items-center py-2">
                <ProfileRadar values={sectionMeans} />
              </div>
            </div>

            <div className="bento-card p-6 sm:p-7 flex flex-col justify-between gap-4 bg-white border border-[#9daeac]/35">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Baseline Profile Snapshot
                </h2>
                {profile.baseline ? (
                  <div className="rounded-xl bg-[#f0f0e9] p-4 border border-[#9daeac]/30 text-xs flex flex-col gap-1.5">
                    <span className="font-semibold text-slate-800">
                      Calibrated: {new Date(profile.baseline.takenAt).toLocaleDateString()}
                    </span>
                    <span className="text-slate-500 font-mono">
                      Engine Version: {profile.baseline.engineVersion}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No baseline snapshot stored yet.</p>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                As you complete practice drills and scheduled reassessments, your rating intervals
                narrow and adapt in real time.
              </p>
            </div>
          </div>

          {/* Interactive GitHub-style Study Activity Heatmap */}
          <section className="bento-card p-6 bg-white border border-[#9daeac]/35">
            <StudyHeatmap
              activity={activity}
              loading={activityLoading}
              onFilterChange={handleFilterChange}
              selectedFilterDays={filterDays}
            />
          </section>

          <div className="bento-card overflow-hidden bg-white border border-[#9daeac]/35">
            <div className="border-b border-[#9daeac]/30 p-4 px-6 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Topic-by-Topic Estimates ({profile.topics.length} topics)
              </h2>
              <span className="text-[11px] text-slate-400 font-medium font-mono">
                Click column header to sort
              </span>
            </div>
            <TopicTable rows={profile.topics} />
          </div>

          {/* External test scores (PH13-T05) */}
          <section className="bento-card p-6 flex flex-col gap-4 bg-white border border-[#9daeac]/35">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                External Test Scores
              </h2>
              <label className="cursor-pointer rounded-md border border-[#9daeac]/40 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#f0f0e9]">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => void onCsvUpload(e)}
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Log scores from AMCAT, eLitmus, CoCubes, TCS NQT, mocks, etc. CSV columns:{' '}
              <code>source, assessmentName, takenAt, totalScore</code> (optional:{' '}
              <code>maxScore, percentile, notes</code>).
            </p>
            {csvMsg && <p className="text-xs text-slate-600">{csvMsg}</p>}
            {scores.length > 0 && (
              <ul className="divide-y divide-[#9daeac]/20 text-xs">
                {scores.map((sc) => (
                  <li key={sc.id} className="flex items-center justify-between py-2">
                    <span>
                      <strong className="text-slate-800">{sc.assessmentName}</strong>{' '}
                      <span className="text-slate-500">· {sc.source}</span>
                      {sc.percentile != null && (
                        <span className="ml-2 rounded-full bg-[#e3eceb] px-2 py-0.5 text-[10px] font-bold text-[#174c4b]">
                          p{Math.round(sc.percentile)}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3 text-slate-500">
                      {sc.totalScore}/{sc.maxScore} · {new Date(sc.takenAt).toLocaleDateString()}
                      <button
                        type="button"
                        onClick={() => void removeScore(sc.id)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => void addScore(e)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              <select
                value={scoreForm.source}
                onChange={(e) => setScoreForm({ ...scoreForm, source: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              >
                {['Manual', 'AMCAT', 'eLitmus', 'CoCubes', 'TCS NQT', 'CampusMock', 'Other'].map(
                  (o) => (
                    <option key={o}>{o}</option>
                  ),
                )}
              </select>
              <input
                required
                placeholder="Assessment name"
                value={scoreForm.assessmentName}
                onChange={(e) => setScoreForm({ ...scoreForm, assessmentName: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <input
                required
                type="date"
                value={scoreForm.takenAt}
                onChange={(e) => setScoreForm({ ...scoreForm, takenAt: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <input
                required
                type="number"
                min={0}
                placeholder="Score"
                value={scoreForm.totalScore}
                onChange={(e) => setScoreForm({ ...scoreForm, totalScore: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <input
                required
                type="number"
                min={1}
                placeholder="Max score"
                value={scoreForm.maxScore}
                onChange={(e) => setScoreForm({ ...scoreForm, maxScore: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Percentile (opt)"
                value={scoreForm.percentile}
                onChange={(e) => setScoreForm({ ...scoreForm, percentile: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <input
                placeholder="Notes (opt)"
                value={scoreForm.notes}
                onChange={(e) => setScoreForm({ ...scoreForm, notes: e.target.value })}
                className="col-span-2 rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-md bg-[#174c4b] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Add score
              </button>
            </form>
            {scoreMsg && <p className="text-xs text-slate-600">{scoreMsg}</p>}
          </section>

          {/* Pattern reports (PH13-T06) */}
          <section className="bento-card p-6 flex flex-col gap-4 bg-white border border-[#9daeac]/35">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Assessment Pattern Reports
            </h2>
            <p className="text-[11px] text-slate-500">
              Contribute structural observations (question counts, section weights, timing) about a
              company's test. Reports are reviewed before they influence blueprints.
            </p>
            {reports.length > 0 && (
              <ul className="divide-y divide-[#9daeac]/20 text-xs">
                {reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <span>
                      <strong className="text-slate-800">{r.company}</strong>{' '}
                      <span className="text-slate-500">· {r.field}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : r.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => void addReport(e)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              <input
                required
                placeholder="Company"
                value={reportForm.company}
                onChange={(e) => setReportForm({ ...reportForm, company: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              />
              <select
                value={reportForm.field}
                onChange={(e) => setReportForm({ ...reportForm, field: e.target.value })}
                className="rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs"
              >
                {[
                  'numQuestions',
                  'timeLimit',
                  'sectionWeights',
                  'negativeMarking',
                  'calculatorAllowed',
                  'subsections',
                ].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                placeholder='Claim JSON e.g. {"quant":40}'
                value={reportForm.claim}
                onChange={(e) => setReportForm({ ...reportForm, claim: e.target.value })}
                className="col-span-1 rounded border border-[#9daeac]/40 px-2 py-1.5 text-xs sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-md bg-[#174c4b] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Submit
              </button>
            </form>
            {reportMsg && <p className="text-xs text-slate-600">{reportMsg}</p>}
          </section>

          {snapshots.length > 0 && (
            <div className="bento-card p-6 flex flex-col gap-3 bg-white border border-[#9daeac]/35">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Historical Calibration Snapshots
              </h2>
              <ul className="divide-y divide-[#9daeac]/20 text-xs">
                {snapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2">
                      {s.isBaseline && (
                        <span className="rounded-full bg-[#e3eceb] border border-[#9daeac]/40 px-2 py-0.5 text-[11px] font-bold text-[#174c4b] font-mono">
                          baseline
                        </span>
                      )}
                      <strong className="text-slate-800">{s.trigger}</strong>
                    </span>
                    <span className="text-slate-400 text-[11px] font-mono">
                      {new Date(s.takenAt).toLocaleDateString()} · engine {s.engineVersion}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
