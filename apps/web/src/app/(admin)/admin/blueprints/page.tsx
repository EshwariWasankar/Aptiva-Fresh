'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProvenanceBadge } from '../../../../components/ProvenanceBadge';
import { BlueprintEditorForm } from '../../../../components/BlueprintEditorForm';
import { ApiError } from '../../../../lib/apiClient';
import {
  adminAddBlueprintVersion,
  adminCreateBlueprint,
  adminGetBlueprint,
  adminListBlueprints,
  adminListTopics,
  type BlueprintBody,
  type BlueprintDetail,
  type BlueprintListItem,
  type TopicNode,
} from '../../../../lib/content';
import { draftBlueprintFromRecords } from '../../../../lib/import';

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'version'; assessmentId: string };

export default function BlueprintsPage() {
  const [items, setItems] = useState<BlueprintListItem[]>([]);
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, t] = await Promise.all([adminListBlueprints(), adminListTopics()]);
      setItems(b);
      setTopics(t);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setError(null);
    try {
      setDetail(await adminGetBlueprint(id));
      setMode({ kind: 'list' });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Failed to load blueprint');
    }
  }

  async function submit(body: BlueprintBody & { slug?: string; company?: string; name?: string }) {
    if (mode.kind === 'version') {
      await adminAddBlueprintVersion(mode.assessmentId, body);
      await openDetail(mode.assessmentId);
      await load();
      setMode({ kind: 'list' });
    } else {
      if (!body.slug || !body.company || !body.name) return;
      const created = await adminCreateBlueprint({
        ...body,
        slug: body.slug,
        company: body.company,
        name: body.name,
      });
      setDetail(created);
      await load();
      setMode({ kind: 'list' });
    }
  }

  const [draftCompany, setDraftCompany] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);

  async function draftFromRecords() {
    if (!draftCompany.trim()) return;
    setDraftBusy(true);
    setError(null);
    try {
      await draftBlueprintFromRecords({ company: draftCompany.trim() });
      setDraftCompany('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : 'Draft failed');
    } finally {
      setDraftBusy(false);
    }
  }

  const currentVersion = detail?.versions.find((v) => v.isCurrent) ?? detail?.versions[0];

  if (mode.kind === 'new') {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          New Assessment Blueprint
        </h1>
        <BlueprintEditorForm
          topics={topics}
          onSubmit={submit}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </div>
    );
  }

  if (mode.kind === 'version' && detail) {
    // Prefill from the current version so admins edit a copy, not a blank.
    const v = currentVersion;
    const sourceIndex = new Map(v?.sources.map((s, i) => [s.id, i]) ?? []);
    const idx = (s: { id: string } | null) => (s ? sourceIndex.get(s.id) : undefined);
    const initial: BlueprintBody | undefined = v
      ? {
          validFrom: v.validFrom.slice(0, 10),
          lastVerifiedAt: v.lastVerifiedAt?.slice(0, 10) ?? null,
          sources: v.sources.map((s) => ({
            sourceType: s.sourceType as BlueprintBody['sources'][number]['sourceType'],
            reference: s.reference,
            confidence: s.confidence as BlueprintBody['sources'][number]['confidence'],
            lastVerifiedAt: s.lastVerifiedAt?.slice(0, 10) ?? null,
          })),
          sections: v.sections.map((s) => ({
            name: s.name,
            orderNo: s.orderNo,
            durationMin: s.durationMin,
            questionCountMin: s.questionCountMin,
            questionCountMax: s.questionCountMax,
            negativeMarking: s.negativeMarking != null ? Number(s.negativeMarking) : null,
            formatMix: s.formatMix
              ? { mcq: s.formatMix.mcq ?? 0, numerical: s.formatMix.numerical ?? 0 }
              : null,
            sourceIndex: idx(s.source),
            weights: s.weights.map((w) => ({
              topicSlug: w.topic.slug,
              share: w.share,
              difficultyBand: w.difficultyBand,
              paceSeconds: w.paceSeconds,
              sourceIndex: idx(w.source),
            })),
          })),
        }
      : undefined;
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          New Blueprint Version — {detail.name}
        </h1>
        <BlueprintEditorForm
          topics={topics}
          assessmentId={mode.assessmentId}
          initial={initial}
          onSubmit={submit}
          onCancel={() => setMode({ kind: 'list' })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-stone-200/50 pb-5 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Assessment Blueprints
          </h1>
          <p className="mt-1 text-xs text-stone-500">
            Define corporate assessment test patterns, section durations, and topic weighting
            matrix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Draft from company records…"
            value={draftCompany}
            onChange={(e) => setDraftCompany(e.target.value)}
            className="glass-input px-3 py-1.5 text-xs w-48"
          />
          <button
            type="button"
            disabled={draftBusy || !draftCompany.trim()}
            onClick={() => void draftFromRecords()}
            className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
          >
            Draft from records
          </button>
          <button
            type="button"
            onClick={() => setMode({ kind: 'new' })}
            className="btn-primary py-1.5 px-3.5 text-xs font-semibold"
          >
            + New blueprint
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card p-10 text-center text-xs text-stone-400">
          Loading blueprints…
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="glass-card glass-card-interactive p-5 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="font-bold text-sm text-stone-900">{a.name}</div>
                <div className="text-xs text-stone-500 mt-0.5">
                  {a.company} · slug: <code className="text-[11px] text-stone-700">{a.slug}</code>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-100">
                {a.versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => void openDetail(a.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      v.isCurrent
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    v{v.version} {v.isCurrent ? '· active' : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    void openDetail(a.id).then(() =>
                      setMode({ kind: 'version', assessmentId: a.id }),
                    );
                  }}
                  className="btn-secondary ml-auto py-0.5 px-2.5 text-[11px] font-semibold"
                >
                  + New version
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detail && currentVersion && (
        <div className="glass-card p-6 flex flex-col gap-4 border-2 border-purple-200/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3 gap-2">
            <div>
              <h2 className="text-lg font-bold text-stone-900">{detail.name}</h2>
              <span className="text-xs text-stone-500 font-medium">
                Version {currentVersion.version}{' '}
                {currentVersion.lastVerifiedAt
                  ? `· verified ${new Date(currentVersion.lastVerifiedAt).toLocaleDateString()}`
                  : '· unverified'}
              </span>
            </div>
            <span className="rounded-full bg-purple-50 border border-purple-200/50 px-3 py-1 text-xs font-semibold text-purple-900">
              {currentVersion.sections.length} test sections
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {currentVersion.sections.map((s) => (
              <div
                key={s.id}
                className="rounded-xl bg-stone-50/70 p-4 border border-stone-200/40 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/30 pb-2">
                  <span className="font-bold text-xs text-stone-900">
                    Section {s.orderNo}. {s.name}
                  </span>
                  <ProvenanceBadge source={s.source} />
                </div>
                <div className="text-xs text-stone-600 font-medium">
                  {s.durationMin ?? '?'} min · {s.questionCountMin ?? '?'}–
                  {s.questionCountMax ?? '?'} questions
                  {s.negativeMarking != null ? ` · −${s.negativeMarking} negative marking` : ''}
                </div>
                <ul className="flex flex-col gap-1.5 pt-1">
                  {s.weights.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white/70 p-2 px-3 rounded-lg border border-stone-200/30"
                    >
                      <span className="font-medium text-stone-800">
                        {w.topic.name} —{' '}
                        <strong className="text-stone-900">{Math.round(w.share * 100)}%</strong>
                        {w.difficultyBand ? ` · band ${w.difficultyBand}` : ''}
                        {w.paceSeconds ? ` · ~${w.paceSeconds}s` : ''}
                      </span>
                      <ProvenanceBadge source={w.source} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-stone-100">
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Revision Log
            </h3>
            <ul className="flex flex-col gap-1 text-xs text-stone-600">
              {detail.versions.map((v) => (
                <li key={v.id} className="flex justify-between py-1">
                  <span>
                    v{v.version} —{' '}
                    {v.isCurrent ? (
                      <strong className="text-emerald-700">active</strong>
                    ) : (
                      'superseded'
                    )}{' '}
                    · valid from {new Date(v.validFrom).toLocaleDateString()}
                  </span>
                  <span className="text-stone-400">{v.sections.length} sections</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
