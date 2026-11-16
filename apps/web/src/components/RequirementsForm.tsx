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

/** P-11 — preparation requirements form with pastel & purple aesthetics. */
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

  if (loading) return <p className="text-xs text-slate-400">Loading requirements…</p>;

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6" noValidate>
      {formError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800"
        >
          {formError}
        </div>
      )}

      {/* Target Assessment Mode */}
      <fieldset className="glass-card p-5 flex flex-col gap-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Target Assessment Blueprint
        </legend>
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
            <input
              type="radio"
              checked={mode === 'general'}
              onChange={() => setMode('general')}
              className="accent-purple-600"
            />
            <span>General campus placement aptitude (balanced syllabus)</span>
          </label>
          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
            <input
              type="radio"
              checked={mode === 'assessment_specific'}
              onChange={() => setMode('assessment_specific')}
              className="accent-purple-600"
            />
            <span>Specific company assessment</span>
          </label>
        </div>
        {mode === 'assessment_specific' && (
          <select
            value={assessmentId}
            onChange={(e) => setAssessmentId(e.target.value)}
            className="glass-input mt-1 px-3.5 py-2.5 text-xs font-medium"
          >
            <option value="">Select target company assessment…</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.company}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      {/* Dates Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Target assessment date
          <input
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-xs font-mono"
          />
          {errors.testDate && (
            <span className="text-[11px] text-rose-600 font-medium">{errors.testDate}</span>
          )}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Preparation deadline
          <input
            type="date"
            value={deadlineDate}
            onChange={(e) => setDeadlineDate(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-xs font-mono"
          />
          {errors.deadlineDate && (
            <span className="text-[11px] text-rose-600 font-medium">{errors.deadlineDate}</span>
          )}
        </label>
      </div>

      {/* Daily Time Budget */}
      <fieldset className="glass-card p-5 flex flex-col gap-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Available study minutes per day (0 or ≥10)
        </legend>
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7 pt-1">
          {DAYS.map((d) => (
            <label
              key={d.key}
              className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 text-center"
            >
              <span>{d.label}</span>
              <input
                type="number"
                min={0}
                max={240}
                value={minutes[d.key] ?? '0'}
                onChange={(e) => setMinutes((m) => ({ ...m, [d.key]: e.target.value }))}
                className="glass-input px-2 py-1.5 text-center text-xs font-semibold font-mono"
              />
              {errors[`min-${d.key}`] && (
                <span className="text-[10px] text-rose-600 font-normal">
                  {errors[`min-${d.key}`]}
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Block Length and Level */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Target session block length
          <select
            value={blockLength}
            onChange={(e) => setBlockLength(Number(e.target.value))}
            className="glass-input px-3.5 py-2.5 text-xs"
          >
            {BLOCK_LENGTHS.map((b) => (
              <option key={b} value={b}>
                {b} minutes per block
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
          Preparation intensity level
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-xs"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Wanted Topics */}
      {topicOptions.length > 0 && (
        <fieldset className="glass-card p-5 flex flex-col gap-3">
          <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Priority Topics (optional override)
          </legend>
          <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pt-1">
            {topicOptions.map((t) => {
              const isSelected = wanted.has(t.topic.id);
              return (
                <label
                  key={t.topic.id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 text-purple-950 font-semibold shadow-2xs'
                      : 'border-purple-100 bg-white/70 text-slate-600 hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
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
              );
            })}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-fit py-2.5 px-6 text-xs font-semibold disabled:opacity-50"
      >
        {pending ? 'Synthesizing schedule…' : 'Save requirements & generate plan →'}
      </button>
    </form>
  );
}
