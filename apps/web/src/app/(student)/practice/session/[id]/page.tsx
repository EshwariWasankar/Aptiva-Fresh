'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Katex } from '../../../../../components/Katex';
import { ErrorCausePicker } from '../../../../../components/ErrorCausePicker';
import {
  finishSession,
  getNext,
  revealAttempt,
  submitAttempt,
  type AttemptResponse,
  type RevealResponse,
  type ServedQuestion,
} from '../../../../../lib/practice';
import { randomUUID } from '../../../../../lib/uuid';
import { ApiError } from '../../../../../lib/apiClient';
import { IconClock, IconSparkles } from '../../../../../components/Icons';

type Phase = 'loading' | 'lesson' | 'question' | 'feedback' | 'done' | 'error';

interface PendingAttempt {
  attemptId: string;
  questionId: string;
  payload: Record<string, unknown>;
}

/** P-14 — practice runner: MCQ + numeric, display timer, instant feedback. */
export default function PracticeRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [next, setNext] = useState<ServedQuestion | null>(null);
  const [feedback, setFeedback] = useState<AttemptResponse | null>(null);
  const [reveal, setReveal] = useState<RevealResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [numeric, setNumeric] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const attemptsRef = useRef<PendingAttempt[]>([]);
  const shownAtRef = useRef<number>(Date.now());
  const questionIdRef = useRef<string | null>(null);

  const loadNext = useCallback(async () => {
    setPhase('loading');
    setError(null);
    try {
      const n = await getNext(id);
      setNext(n);
      if (n.lesson) {
        setPhase('lesson');
      } else if (n.done || !n.question) {
        setPhase('done');
      } else {
        questionIdRef.current = n.question.id;
        shownAtRef.current = Date.now();
        setElapsed(0);
        setSelected(null);
        setNumeric('');
        setPhase('question');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the next question.');
      setPhase('error');
    }
  }, [id]);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  // Display-only timer (server stamps shown_at/answered_at).
  useEffect(() => {
    if (phase !== 'question') return;
    const t = setInterval(() => setElapsed(Date.now() - shownAtRef.current), 500);
    return () => clearInterval(t);
  }, [phase]);

  async function answer(skipped: boolean) {
    const q = next?.question;
    if (!q) return;
    const attemptId = randomUUID();
    const payload = skipped
      ? { attemptId, skipped: true }
      : q.format === 'mcq'
        ? { attemptId, selectedOptionId: selected }
        : { attemptId, numericInput: numeric };
    setPhase('loading');
    try {
      const res = await submitAttempt(id, q.id, {
        attemptId,
        ...(payload as object),
        answerChanges: 0,
        revisitCount: 0,
      });
      attemptsRef.current.push({ attemptId, questionId: q.id, payload });
      setFeedback(res);
      setReveal(null);
      if (res.isCorrect === false || res.isCorrect === null) {
        revealAttempt(id, attemptId)
          .then(setReveal)
          .catch(() => undefined);
      }
      setPhase('feedback');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit the answer.');
      setPhase('question');
    }
  }

  async function finish() {
    setFinishing(true);
    try {
      await finishSession(id, {
        attemptIds: attemptsRef.current.map((a) => a.attemptId),
        attempts: attemptsRef.current.map((a) => ({
          ...a.payload,
          questionId: a.questionId,
        })),
      });
      router.replace(`/practice/session/${id}/summary`);
    } catch {
      setError('Could not finish the session — your answers are saved; try again.');
      setFinishing(false);
    }
  }

  const q = next?.question;
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Top Session Progress Bar */}
      <div className="glass-header flex items-center justify-between px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {next?.lesson ? 'Concept review' : 'Active Practice Drill'}
        </span>
        <div className="flex items-center gap-2 tabular-nums text-xs font-semibold text-stone-700 bg-stone-100/90 px-3 py-1 rounded-full border border-stone-200/50 shadow-2xs">
          <IconClock className="w-3.5 h-3.5 text-blue-600" />
          <span>
            {mm}:{String(ss).padStart(2, '0')}
          </span>
          {q && (
            <span className="text-stone-400 font-normal">
              · target ~{Math.round(q.expectedTimeMs / 1000)}s
            </span>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {phase === 'loading' && (
        <div className="glass-card p-10 text-center text-xs text-stone-400">
          Loading next question…
        </div>
      )}

      {/* Lesson View */}
      {phase === 'lesson' && next?.lesson && (
        <section className="glass-card p-6 sm:p-8 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
            <IconSparkles className="w-4 h-4" />
            <span>Key Concept</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900">{next.lesson.title}</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700 bg-stone-50/70 p-4 rounded-xl border border-stone-200/40">
            {next.lesson.content}
          </div>
          <button
            type="button"
            onClick={() => void loadNext()}
            className="btn-primary mt-2 py-2.5 px-5 text-xs font-semibold w-fit"
          >
            Start questions →
          </button>
        </section>
      )}

      {/* Question View */}
      {phase === 'question' && q && (
        <section className="glass-card p-6 sm:p-8 flex flex-col gap-6">
          <div className="text-sm sm:text-base font-medium text-stone-900 leading-relaxed">
            <Katex text={q.stem} />
          </div>

          {q.format === 'mcq' ? (
            <div className="flex flex-col gap-2.5">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o.id)}
                  className={`rounded-xl border p-3.5 px-4 text-left text-xs sm:text-sm font-medium transition-all ${
                    selected === o.id
                      ? 'border-blue-600 bg-blue-50/90 text-blue-900 shadow-xs ring-1 ring-blue-500'
                      : 'border-stone-200/70 bg-stone-50/60 hover:bg-white text-stone-800'
                  }`}
                >
                  {o.text}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={numeric}
                onChange={(e) => setNumeric(e.target.value)}
                placeholder={
                  q.answerFormat === 'integer'
                    ? 'Whole number answer'
                    : `Decimal answer${q.decimalPlaces ? ` (up to ${q.decimalPlaces} places)` : ''}`
                }
                className="glass-input w-64 px-4 py-2.5 text-sm"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              disabled={q.format === 'mcq' ? !selected : !numeric.trim()}
              onClick={() => void answer(false)}
              className="btn-primary py-2 px-5 text-xs font-semibold disabled:opacity-40"
            >
              Submit answer &amp; next
            </button>
            <button
              type="button"
              onClick={() => void answer(true)}
              className="btn-secondary py-2 px-4 text-xs font-medium"
            >
              Skip question
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="ml-auto btn-secondary py-2 px-4 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              {finishing ? 'Finishing…' : 'Finish session'}
            </button>
          </div>
        </section>
      )}

      {/* Feedback View */}
      {phase === 'feedback' && feedback && (
        <div className="flex flex-col gap-4">
          {reveal && (
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/80 p-4 text-xs text-blue-950 flex items-center justify-between">
              <span>Correct answer:</span>
              <strong className="text-sm font-bold text-blue-900">
                {reveal.correctOption ? reveal.correctOption.text : (reveal.numericAnswer ?? '—')}
              </strong>
            </div>
          )}

          <section className="glass-card p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold text-sm ${
                  feedback.isCorrect
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {feedback.isCorrect ? '✓' : '✗'}
              </span>
              <div>
                <h3
                  className={`text-base font-bold ${
                    feedback.isCorrect ? 'text-emerald-800' : 'text-amber-800'
                  }`}
                >
                  {feedback.isCorrect
                    ? 'Correct answer!'
                    : feedback.isCorrect === false
                      ? 'Not quite right'
                      : 'Skipped'}
                </h3>
                {feedback.paceRatio != null && feedback.paceRatio > 1.5 && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    Took longer than the target pace for this difficulty band.
                  </p>
                )}
              </div>
            </div>

            {!feedback.isCorrect && feedback.promptErrorCause && feedback.attemptId && (
              <div className="rounded-xl bg-stone-50/80 p-4 border border-stone-200/50">
                <ErrorCausePicker attemptId={feedback.attemptId} onSaved={() => undefined} />
              </div>
            )}

            {reveal?.solution && (
              <details className="rounded-xl bg-stone-50/80 border border-stone-200/50 p-4 group">
                <summary className="cursor-pointer text-xs font-bold text-blue-700 flex items-center justify-between">
                  <span>Worked Step-by-Step Solution</span>
                  <span className="text-stone-400 group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="mt-3 whitespace-pre-wrap text-xs text-stone-700 leading-relaxed border-t border-stone-200/40 pt-3">
                  {reveal.solution}
                </div>
              </details>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => void loadNext()}
                className="btn-primary py-2 px-5 text-xs font-semibold"
              >
                Next question →
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={finishing}
                className="btn-secondary py-2 px-4 text-xs font-medium"
              >
                {finishing ? 'Finishing…' : 'Finish session'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Done View */}
      {phase === 'done' && (
        <section className="glass-card p-10 text-center flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xl shadow-xs">
            ✓
          </span>
          <h2 className="text-xl font-bold text-stone-900">Drill Completed</h2>
          <p className="text-xs text-stone-500 max-w-sm">
            {next?.reason === 'pool_exhausted'
              ? 'You have answered all available questions in this block pool.'
              : 'All scheduled questions for this drill session are complete.'}
          </p>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="btn-primary mt-2 py-2.5 px-6 text-xs font-semibold"
          >
            {finishing ? 'Processing results…' : 'View session summary →'}
          </button>
        </section>
      )}

      {/* Error View */}
      {phase === 'error' && (
        <section className="glass-card p-8 text-center flex flex-col items-center gap-3">
          <p className="text-xs text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className="btn-secondary py-2 px-5 text-xs font-medium"
          >
            Back to practice
          </button>
        </section>
      )}
    </div>
  );
}
