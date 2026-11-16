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

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [snapshots, setSnapshots] = useState<ProfileSnapshotRow[]>([]);
  const [activity, setActivity] = useState<ActivityHistoryResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [filterDays, setFilterDays] = useState(365);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const handleFilterChange = (days: number) => {
    setFilterDays(days);
    setActivityLoading(true);
    getCommitmentActivity(days)
      .then(setActivity)
      .catch(() => undefined)
      .finally(() => setActivityLoading(false));
  };

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
      <div className="border-b border-stone-200/70 pb-4">
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
        <div className="glass-card p-12 text-center text-xs text-slate-400">
          Loading mastery profile…
        </div>
      )}

      {profile && profile.topics.length === 0 && (
        <div className="glass-card p-10 text-center flex flex-col items-center gap-3">
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
            <div className="bento-card p-6 flex flex-col justify-between bg-white">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                Section Mastery Radar
              </h2>
              <div className="flex justify-center items-center py-2">
                <ProfileRadar values={sectionMeans} />
              </div>
            </div>

            <div className="bento-card p-6 sm:p-7 flex flex-col justify-between gap-4 bg-white">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                  Baseline Profile Snapshot
                </h2>
                {profile.baseline ? (
                  <div className="rounded-xl bg-stone-50 p-4 border border-stone-200/70 text-xs flex flex-col gap-1.5">
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
          <section className="bento-card p-6 bg-white">
            <StudyHeatmap
              activity={activity}
              loading={activityLoading}
              onFilterChange={handleFilterChange}
              selectedFilterDays={filterDays}
            />
          </section>

          <div className="bento-card overflow-hidden bg-white">
            <div className="border-b border-stone-100 p-4 px-6 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Topic-by-Topic Estimates ({profile.topics.length} topics)
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                Click column header to sort
              </span>
            </div>
            <TopicTable rows={profile.topics} />
          </div>

          {snapshots.length > 0 && (
            <div className="bento-card p-6 flex flex-col gap-3 bg-white">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Historical Calibration Snapshots
              </h2>
              <ul className="divide-y divide-stone-100 text-xs">
                {snapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2">
                      {s.isBaseline && (
                        <span className="rounded-full bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[11px] font-bold text-indigo-700 font-mono">
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
