'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Katex } from '../../../../../components/Katex';
import { ErrorCausePicker } from '../../../../../components/ErrorCausePicker';
import { ConflictNote } from '../../../../../components/ConflictNote';
import {
  getDiagnosticReview,
  type ReviewItem,
  type ReviewResponse,
} from '../../../../../lib/diagnostic';

/**
 * P-09 — mistake review with pastel & purple aesthetics:
 * question, correct answer, worked solution, time vs expected, error-cause tag and skip-for-now.
 */
export default function DiagnosticReviewPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    getDiagnosticReview(id)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load review'));
  }, [id]);

  function skip(item: ReviewItem) {
    setSkipped((prev) => new Set(prev).add(item.attemptId));
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="glass-card p-12 text-center text-xs text-slate-400">
        Loading mistake review…
      </div>
    );
  }

  const misses = data.items.filter((i) => i.isCorrect !== true && !skipped.has(i.attemptId));

  if (misses.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center flex flex-col items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xl">
          ✓
        </span>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Nothing to review</h1>
        <p className="text-xs text-slate-500">Every answered question was completely correct.</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-primary mt-2 py-2 px-5 text-xs font-semibold"
        >
          Back to overview →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 w-full overflow-hidden question-container">
      <div className="border-b border-[#9daeac]/30 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Review Diagnostic Mistakes
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {misses.length} item{misses.length === 1 ? '' : 's'} to analyze. Tag why each went wrong
          so your adaptive planner can schedule targeted concept repairs.
        </p>
      </div>

      <div className="flex flex-col gap-5 w-full">
        {misses.map((item) => (
          <article
            key={item.attemptId}
            className="glass-card p-6 flex flex-col gap-4 overflow-hidden max-w-full"
          >
            <div className="flex items-center justify-between text-xs border-b border-[#9daeac]/20 pb-3">
              <span className="font-semibold text-slate-600">
                Q{item.sequenceNo} · {item.topicName} ·{' '}
                {item.timeMs != null && item.expectedTimeMs > 0
                  ? `${(item.timeMs / item.expectedTimeMs).toFixed(2)}× expected pace`
                  : '—'}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  item.isCorrect
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/50'
                    : item.skipped
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-rose-50 text-rose-800 border border-rose-200/50'
                }`}
              >
                {item.isCorrect ? 'Correct' : item.skipped ? 'Skipped' : 'Incorrect'}
              </span>
            </div>

            <div className="text-sm font-medium text-slate-900 leading-relaxed max-w-full break-words [overflow-wrap:anywhere] overflow-x-auto">
              <Katex text={item.stem} className="text-sm leading-6 max-w-full break-words" />
            </div>

            {item.format === 'mcq' && (
              <ul className="flex flex-col gap-2 text-xs max-w-full">
                {item.options.map((o) => (
                  <li
                    key={o.id}
                    className={`rounded-xl p-3 px-3.5 border transition-all max-w-full break-words [overflow-wrap:anywhere] flex items-start ${
                      o.isCorrect
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-semibold'
                        : o.id === item.selectedOptionId
                          ? 'bg-rose-50/90 border-rose-300 text-rose-950 font-semibold'
                          : 'bg-white/80 border-[#9daeac]/30 text-slate-700'
                    }`}
                  >
                    <span className="shrink-0 mr-1.5">
                      {o.isCorrect ? '✓' : o.id === item.selectedOptionId ? '✗' : '•'}
                    </span>
                    <Katex text={o.text} className="max-w-full break-words" />
                  </li>
                ))}
              </ul>
            )}

            {item.format === 'numerical' && (
              <div className="rounded-xl bg-[#f0f0e9]/80 p-3.5 border border-[#9daeac]/30 text-xs flex items-center gap-4">
                <div>
                  <span className="text-slate-400 font-medium">Correct answer: </span>
                  <span className="font-mono font-bold text-emerald-800">
                    {item.numericAnswer}
                    {item.answerFormat === 'integer' ? '' : ` (${item.answerFormat})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Your answer: </span>
                  <span className="font-mono font-bold text-rose-800">
                    {item.numericInput ?? '—'}
                  </span>
                </div>
              </div>
            )}

            {item.solution && (
              <details className="rounded-xl bg-[#f0f0e9]/80 border border-[#9daeac]/30 p-4 group">
                <summary className="cursor-pointer text-xs font-bold text-[#174c4b] flex items-center justify-between">
                  <span>Worked step-by-step solution</span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="mt-3 rounded-lg bg-white/90 p-3 text-xs text-slate-800 leading-relaxed border border-[#9daeac]/30">
                  <Katex text={item.solution} />
                </div>
              </details>
            )}

            {item.feedback && (
              <p className="text-xs text-slate-500">
                Tagged cause:{' '}
                <strong className="text-slate-800">{item.feedback.errorTypeLabel}</strong>
                {item.feedback.freeText ? ` — ${item.feedback.freeText}` : ''}
              </p>
            )}

            {item.inference?.conflict && conflicts.get(item.attemptId) !== false && (
              <div className="mt-1">
                <ConflictNote
                  onDismiss={() => {
                    setConflicts((m) => {
                      const next = new Map(m);
                      next.set(item.attemptId, false);
                      return next;
                    });
                  }}
                />
              </div>
            )}

            {!item.feedback && !item.inference?.conflict && (
              <div className="mt-1 rounded-xl bg-[#f0f0e9]/80 p-3.5 border border-[#9daeac]/30">
                <ErrorCausePicker
                  attemptId={item.attemptId}
                  onSaved={(r) => {
                    if (r.conflict) setConflicts((m) => new Map(m).set(item.attemptId, true));
                    void getDiagnosticReview(id).then(setData);
                  }}
                />
              </div>
            )}

            {item.feedback && !item.inference?.conflict && (
              <button
                type="button"
                onClick={() => skip(item)}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition w-fit"
              >
                Skip for now
              </button>
            )}
          </article>
        ))}
      </div>

      <div className="flex gap-3 pt-3 border-t border-[#9daeac]/30">
        <button
          type="button"
          onClick={() => router.push(`/diagnostic/${id}/result`)}
          className="btn-secondary py-2.5 px-5 text-xs font-medium"
        >
          ← Back to result
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="btn-primary py-2.5 px-5 text-xs font-semibold"
        >
          Save &amp; complete review
        </button>
      </div>
    </div>
  );
}
