'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  getRequirements,
  listAssessments,
  putRequirements,
  type PublicAssessment,
  type RequirementsBody,
} from '../lib/content';
import { getProfile, type ProfileResponse } from '../lib/profile';
import { ApiError } from '../lib/apiClient';

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

const BLOCK_LENGTHS = [15, 30, 45, 60, 90] as const;
const LEVELS = [
  { value: 'starting', label: 'Starting from scratch' },
  { value: 'revising', label: 'Revising concepts' },
  { value: 'cramming', label: 'Cramming before the test' },
  { value: 'maintaining', label: 'Maintaining sharpness' },
] as const;

/** P-11 — preparation requirements form (E-021). */
export function RequirementsForm() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<PublicAssessment[]>([]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [mode, setMode] = useState<'general' | 'assessment_specific'>('general');
  const [assessmentId, setAssessmentId] = useState('');
  const [testDate, setTestDate] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [minutes, setMinutes] = useState<Record<string, string>>({});
  const [blockLength, setBlockLength] = useState<number>(45);
  const [wanted, setWanted] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState('revising');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listAssessments(), getRequirements(), getProfile().catch(() => null)])
      .then(([a, r, p]) => {
        setAssessments(a);
        setProfile(p);
        const req = r.requirement;
        if (req) {
          setMode(req.mode);
          setAssessmentId(req.assessmentId ?? '');
          setTestDate(req.testDate);
          setDeadlineDate(req.deadlineDate);
          setMinutes(
            Object.fromEntries(
              DAYS.map((d) => [
                d.key,
                String((req.minutesPerWeekday as Record<string, number>)?.[d.key] ?? 0),
              ]),
            ),
          );
          setBlockLength(req.blockLengthMinutes);
          setWanted(new Set((req.wantedTopics as string[]) ?? []));
          setLevel(req.preparationLevel ?? 'revising');
        }
      })
      .catch(() => setFormError('Could not load the form.'))
      .finally(() => setLoading(false));
  }, []);

  const topicOptions = useMemo(
    () => (profile?.topics ?? []).filter((t) => t.topic.level === 'topic'),
    [profile],
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    const today = new Date().toISOString().slice(0, 10);
    if (!testDate) e.testDate = 'Test date is required.';
    else if (testDate <= today) e.testDate = 'Test date must be in the future.';
    if (!deadlineDate) e.deadlineDate = 'Deadline is required.';
    else if (testDate && deadlineDate > testDate)
      e.deadlineDate = 'Deadline cannot be after the test date.';
    for (const d of DAYS) {
      const v = Number(minutes[d.key] ?? 0);
      if (Number.isNaN(v) || v < 0 || v > 240) e[`min-${d.key}`] = '0–240';
      else if (v !== 0 && v < 10) e[`min-${d.key}`] = '0 or at least 10';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setPending(true);
    try {
      const body: RequirementsBody = {
        mode,
        assessmentId: mode === 'assessment_specific' ? assessmentId || null : null,
        testDate,
        deadlineDate,
        minutesPerWeekday: Object.fromEntries(
          DAYS.map((d) => [d.key, Number(minutes[d.key] ?? 0)]),
        ),
        blockLengthMinutes: blockLength,
        wantedTopics: [...wanted],
        preparationLevel: level,
      };
      await putRequirements(body);
      router.replace('/plan');
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 422
          ? 'Some values were rejected — check the highlighted fields.'
          : 'Could not save requirements. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p className="text-neutral-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-5" noValidate>
      {formError && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {formError}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Target assessment</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={mode === 'general'} onChange={() => setMode('general')} />
          General aptitude (balanced blueprint)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={mode === 'assessment_specific'}
            onChange={() => setMode('assessment_specific')}
          />
          Specific assessment
        </label>
        {mode === 'assessment_specific' && (
          <select
            value={assessmentId}
            onChange={(e) => setAssessmentId(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Choose an assessment…</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.company}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Test date
          <input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
          {errors.testDate && <span className="text-xs text-red-600">{errors.testDate}</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Preparation deadline
          <input
            type="date"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          />
          {errors.deadlineDate && (
            <span className="text-xs text-red-600">{errors.deadlineDate}</span>
          )}
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Minutes per weekday (0 or ≥10)</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DAYS.map((d) => (
            <label key={d.key} className="flex flex-col gap-1 text-xs">
              {d.label}
              <input
                type="number"
                min={0}
                max={240}
                value={minutes[d.key] ?? '0'}
                onChange={(e) => setMinutes((m) => ({ ...m, [d.key]: e.target.value }))}
                className="rounded border border-neutral-300 px-2 py-1"
              />
              {errors[`min-${d.key}`] && (
                <span className="text-red-600">{errors[`min-${d.key}`]}</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Block length
          <select
            value={blockLength}
            onChange={(e) => setBlockLength(Number(e.target.value))}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            {BLOCK_LENGTHS.map((b) => (
              <option key={b} value={b}>
                {b} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Preparation level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded border border-neutral-300 px-3 py-2"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {topicOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Wanted topics (optional)</legend>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {topicOptions.map((t) => (
              <label
                key={t.topic.id}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                  wanted.has(t.topic.id)
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-neutral-300 text-neutral-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={wanted.has(t.topic.id)}
                  onChange={() =>
                    setWanted((w) => {
                      const n = new Set(w);
                      if (n.has(t.topic.id)) n.delete(t.topic.id);
                      else n.add(t.topic.id);
                      return n;
                    })
                  }
                />
                {t.topic.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-neutral-900 px-5 py-2.5 text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save requirements & generate plan'}
      </button>
    </form>
  );
}
