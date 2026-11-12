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
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{next?.lesson ? 'Review the concept first' : 'Practice'}</span>
        <span className="tabular-nums">
          {mm}:{String(ss).padStart(2, '0')}
          {q && ` · expected ~${Math.round(q.expectedTimeMs / 1000)}s`}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {phase === 'loading' && <p className="text-neutral-500">Loading…</p>}

      {phase === 'lesson' && next?.lesson && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h2 className="text-lg font-semibold">{next.lesson.title}</h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
            {next.lesson.content}
          </div>
          <button
            type="button"
            onClick={() => void loadNext()}
            className="mt-4 rounded-md bg-neutral-900 px-5 py-2 text-white"
          >
            Start questions
          </button>
        </section>
      )}

      {phase === 'question' && q && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <Katex text={q.stem} />
          {q.format === 'mcq' ? (
            <div className="mt-4 flex flex-col gap-2">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelected(o.id)}
                  className={`rounded-md border px-4 py-2.5 text-left text-sm ${
                    selected === o.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {o.text}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={numeric}
                onChange={(e) => setNumeric(e.target.value)}
                placeholder={
                  q.answerFormat === 'integer'
                    ? 'Whole number'
                    : `Decimal${q.decimalPlaces ? ` (up to ${q.decimalPlaces} places)` : ''}`
                }
                className="w-48 rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              disabled={q.format === 'mcq' ? !selected : !numeric.trim()}
              onClick={() => void answer(false)}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              Answer &amp; next
            </button>
            <button
              type="button"
              onClick={() => void answer(true)}
              className="rounded-md border border-neutral-300 px-5 py-2 text-sm"
            >
              Skip &amp; next
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="ml-auto rounded-md border border-neutral-300 px-5 py-2 text-sm"
            >
              {finishing ? 'Finishing…' : 'Finish session'}
            </button>
          </div>
        </section>
      )}

      {phase === 'feedback' && feedback && (
        <>
          {reveal && (
            <p className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
              Correct answer:{' '}
              <strong>
                {reveal.correctOption ? reveal.correctOption.text : (reveal.numericAnswer ?? '—')}
              </strong>
            </p>
          )}
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
            <p
              className={`text-lg font-semibold ${
                feedback.isCorrect ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {feedback.isCorrect
                ? 'Correct'
                : feedback.isCorrect === false
                  ? 'Not quite'
                  : 'Skipped'}
              {feedback.paceRatio != null && feedback.paceRatio > 1.5 && (
                <span className="ml-2 text-sm font-normal text-neutral-500">
                  slower than expected pace
                </span>
              )}
            </p>
            {!feedback.isCorrect && feedback.promptErrorCause && feedback.attemptId && (
              <div className="mt-3">
                <ErrorCausePicker attemptId={feedback.attemptId} onSaved={() => undefined} />
              </div>
            )}
            {reveal?.solution && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-blue-600">Worked solution</summary>
                <div className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
                  {reveal.solution}
                </div>
              </details>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void loadNext()}
                className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Next question
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                disabled={finishing}
                className="rounded-md border border-neutral-300 px-5 py-2 text-sm"
              >
                {finishing ? 'Finishing…' : 'Finish session'}
              </button>
            </div>
          </section>
        </>
      )}

      {phase === 'done' && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
          <p className="text-neutral-700">
            {next?.reason === 'pool_exhausted'
              ? 'No more questions available right now.'
              : 'Session complete.'}
          </p>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="mt-4 rounded-md bg-neutral-900 px-6 py-2 text-sm text-white"
          >
            {finishing ? 'Finishing…' : 'Finish & see summary'}
          </button>
        </section>
      )}

      {phase === 'error' && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => router.push('/practice')}
            className="mt-4 rounded-md border px-5 py-2 text-sm"
          >
            Back to practice
          </button>
        </section>
      )}
    </div>
  );
}
