'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getProfile,
  getProfileHistory,
  type ProfileResponse,
  type ProfileSnapshotRow,
} from '../../../lib/profile';
import { ProfileRadar } from '../../../components/ProfileRadar';
import { TopicTable } from '../../../components/TopicTable';

export default function Page() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [snapshots, setSnapshots] = useState<ProfileSnapshotRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'));
    getProfileHistory()
      .then((r) => setSnapshots(r.snapshots))
      .catch(() => undefined);
  }, []);

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Practice-based estimates on our version of the test blueprint — not a prediction of any
          employer&apos;s result.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!profile && !error && <p className="text-neutral-500">Loading…</p>}

      {profile && profile.topics.length === 0 && (
        <div className="rounded border border-neutral-200 p-6 text-center">
          <p className="text-neutral-700">No diagnostic data yet.</p>
          <a href="/onboarding/diagnostic" className="mt-2 inline-block text-blue-600 underline">
            Take the setup diagnostic
          </a>
        </div>
      )}

      {profile && profile.topics.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="rounded border border-neutral-200 p-4">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">By section</h2>
              <ProfileRadar values={sectionMeans} />
            </div>
            <div className="rounded border border-neutral-200 p-4">
              <h2 className="mb-2 text-sm font-medium text-neutral-700">Baseline</h2>
              {profile.baseline ? (
                <p className="text-sm text-neutral-600">
                  Snapshot taken {new Date(profile.baseline.takenAt).toLocaleString()} · engine{' '}
                  {profile.baseline.engineVersion}
                </p>
              ) : (
                <p className="text-sm text-neutral-600">No baseline snapshot yet.</p>
              )}
              <p className="mt-2 text-xs text-neutral-500">
                Baseline comparison with later sessions arrives with reassessment (PH-9).
              </p>
            </div>
          </div>
          <div className="rounded border border-neutral-200">
            <div className="border-b px-4 py-3">
              <h2 className="text-sm font-medium text-neutral-700">Topics</h2>
            </div>
            <TopicTable rows={profile.topics} />
          </div>

          {snapshots.length > 0 && (
            <div className="rounded border border-neutral-200">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-medium text-neutral-700">Estimate history</h2>
              </div>
              <ul className="divide-y text-sm">
                {snapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-4 py-2">
                    <span>
                      {s.isBaseline && (
                        <span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          baseline
                        </span>
                      )}
                      {s.trigger}
                    </span>
                    <span className="text-neutral-500">
                      {new Date(s.takenAt).toLocaleString()} · {s.engineVersion}
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
