'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ApiError } from '../../../../lib/apiClient';
import { Katex } from '../../../../components/Katex';
import {
  getNextQuestion,
  pauseDiagnostic,
  submitDiagnostic,
  submitDiagnosticAnswer,
  type ServedQuestion,
} from '../../../../lib/diagnostic';
import { randomUUID } from '../../../../lib/uuid';
import { IconClock } from '../../../../components/Icons';

interface Item {
  question: ServedQuestion;
  position: number;
  total: number;
  shownAtMs: number;
  attemptId: string;
  answered: boolean;
}

/**
 * P-07 — diagnostic runner: stem with KaTeX, MCQ options or numeric
 * entry, display-only timer, skip, next, progress, single pause.
 * Answers are marked server-side; feedback is shown only after submit.
 */
export default function DiagnosticRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [done, setDone] = useState<{ answered: number; total: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const attemptIds = useRef<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNext = useCallback(async () => {
    setError(null);
    try {
      const r = await getNextQuestion(id);
      if (r.done) {
        setDone({ answered: r.answeredCount ?? 0, total: r.totalCount ?? 0 });
        return;
      }
      const q = r.question!;
      setItem({
        question: q,
        position: r.position!,
        total: r.total!,
        shownAtMs: new Date(q.shownAt).getTime(),
        attemptId: randomUUID(),
        answered: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load question');
    }
  }, [id]);

  useEffect(() => {
    void loadNext();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loadNext]);

  // Display-only elapsed timer (server timestamps are authoritative).
  useEffect(() => {
    if (!item || item.answered) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - item.shownAtMs);
    }, 500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [item]);

  const [selected, setSelected] = useState<string | null>(null);
  const [numeric, setNumeric] = useState('');

  useEffect(() => {
    setSelected(null);
    setNumeric('');
    setElapsed(0);
  }, [item?.question.id]);

  async function answer(skipped: boolean): Promise<boolean> {
    if (!item) return false;
    const body = {
      attemptId: item.attemptId,
      selectedOptionId: item.question.format === 'mcq' ? selected : null,
      numericInput: item.question.format === 'numerical' ? numeric || null : null,
      skipped,
      revisitCount: 0,
      answerChanges: 0,
    };
    try {
      const ack = await submitDiagnosticAnswer(id, item.question.id, body);
      attemptIds.current.push(ack.attemptId);
      setItem({ ...item, answered: true });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_NUMERIC_INPUT') {
        setError('That answer could not be parsed — try again.');
        return false;
      }
      setError(e instanceof Error ? e.message : 'Submission failed');
      return false;
    }
  }

  async function next() {
    if (!item) return;
    if (!item.answered) {
      // Answer if possible, otherwise record an honest skip.
      const ok = await answer(!canAnswer);
      if (!ok) return;
    }
    await loadNext();
  }

  async function doPause() {
    setSubmitting(true);
    try {
      await pauseDiagnostic(id);
      setPaused(true);
    } catch {
      setError('Could not pause — the diagnostic may already be paused.');
    } finally {
      setSubmitting(false);
    }
  }

  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await submitDiagnostic(id, attemptIds.current);
      router.push(`/diagnostic/${id}/result`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed');
      setSubmitting(false);
    }
  }

  function fmtElapsed(ms: number) {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  if (paused) {
    return (
      <div className="mx-auto max-w-md py-16 text-center flex flex-col items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 font-bold text-xl">
          ⏸
        </span>
        <h1 className="text-xl font-bold tracking-tight text-stone-900">Diagnostic Paused</h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          Your progress has been safely saved. Each student can pause once during the baseline cycle
          — resume whenever you&apos;re ready.
        </p>
        <button
          type="button"
          onClick={() => {
            setPaused(false);
            void loadNext();
          }}
          className="btn-primary mt-2 py-2.5 px-6 text-xs font-semibold"
        >
          Resume Diagnostic →
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center flex flex-col items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xl">
          ✓
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">All questions answered</h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          {done.answered} of {done.total} questions recorded. Submit to generate your baseline
          profile and precision study plan.
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void doSubmit()}
          className="btn-primary mt-2 py-2.5 px-6 text-xs font-semibold disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit diagnostic →'}
        </button>
        {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    );
  }

  if (!item) {
    return <p className="text-xs text-stone-400 text-center">{error ?? 'Loading question…'}</p>;
  }

  const q = item.question;
  const canAnswer = q.format === 'mcq' ? selected !== null : numeric.trim() !== '';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Header with question count and timer */}
      <div className="glass-header flex items-center justify-between px-5 py-3">
        <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
          Question {item.position} of {item.total}
        </span>
        <div className="flex items-center gap-2 tabular-nums text-xs font-semibold text-stone-700 bg-stone-100/90 px-3 py-1 rounded-full border border-stone-200/50 shadow-2xs">
          <IconClock className="w-3.5 h-3.5 text-blue-600" />
          <span>{fmtElapsed(elapsed)}</span>
          <span className="text-stone-400 font-normal">
            · target ~{Math.round(q.expectedTimeMs / 1000)}s
          </span>
        </div>
      </div>

      {/* Progress Bar in Royal Blue */}
      <div className="h-1.5 w-full rounded-full bg-stone-200/60 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${(item.position / item.total) * 100}%` }}
        />
      </div>

      {/* Question Card */}
      <div className="glass-card p-6 sm:p-8 flex flex-col gap-6">
        <div className="text-sm sm:text-base font-medium text-stone-900 leading-relaxed">
          <Katex text={q.stem} />
        </div>

        {q.format === 'mcq' ? (
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer options">
            {q.options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 px-4 text-xs sm:text-sm font-medium transition-all ${
                  selected === o.id
                    ? 'border-blue-600 bg-blue-50/90 text-blue-900 shadow-xs ring-1 ring-blue-500'
                    : 'border-stone-200/70 bg-stone-50/60 hover:bg-white text-stone-800'
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  value={o.id}
                  checked={selected === o.id}
                  onChange={() => setSelected(o.id)}
                  className="accent-blue-600"
                />
                <Katex text={o.text} />
              </label>
            ))}
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor="numeric-answer" className="text-xs font-semibold text-stone-700">
              Your answer
            </label>
            <input
              id="numeric-answer"
              type="text"
              inputMode="decimal"
              value={numeric}
              onChange={(e) => setNumeric(e.target.value)}
              placeholder="e.g. 42 or 3.14"
              className="glass-input w-48 px-3.5 py-2.5 text-sm font-mono"
            />
            {q.answerFormat === 'integer' && (
              <p className="text-[11px] text-stone-400">Whole integer expected.</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => void doPause()}
          disabled={submitting}
          className="text-xs text-stone-500 hover:text-stone-800 underline transition disabled:opacity-50"
        >
          Pause test (once)
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void next()}
            className="btn-primary py-2 px-6 text-xs font-semibold disabled:opacity-50"
          >
            {item.answered ? 'Next' : canAnswer ? 'Answer & next' : 'Skip & next'}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-stone-400 text-center">
        Answers are marked and timed on the server; accuracy breakdown is revealed upon final
        submission.
      </p>
    </div>
  );
}
