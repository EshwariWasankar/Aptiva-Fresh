'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { getErrorTypes, submitErrorFeedback, type ErrorType } from '../lib/diagnostic';

/**
 * ErrorCausePicker — one-tap error tag after a miss (FR-014, P-09).
 * Selecting a reason stores it via E-016; the stored label is always the
 * student's report. `onSaved` receives the inference result so the parent
 * can render ConflictNote when conflict=true.
 */
export function ErrorCausePicker({
  attemptId,
  onSaved,
}: {
  attemptId: string;
  onSaved?: (result: { conflict: boolean; errorTypeLabel: string }) => void;
}) {
  const [types, setTypes] = useState<ErrorType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getErrorTypes()
      .then(setTypes)
      .catch(() => setTypes([]));
  }, []);

  async function save() {
    if (!selected) return;
    setError(null);
    try {
      const r = await submitErrorFeedback(attemptId, selected, note || undefined);
      setSaved(r.errorTypeLabel);
      onSaved?.({ conflict: r.conflict, errorTypeLabel: r.errorTypeLabel });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save');
    }
  }

  if (saved) {
    return <p className="text-xs font-semibold text-emerald-800">Tagged cause: {saved}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        Tag the cause of this mistake:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <button
            key={t.code}
            type="button"
            onClick={() => setSelected(t.code)}
            className={`rounded-full px-3 py-1 text-xs transition-all ${
              selected === t.code
                ? 'bg-purple-950 text-white font-semibold shadow-xs'
                : 'border border-purple-100 bg-white/70 text-slate-700 hover:border-purple-300 hover:text-purple-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add optional detail on your thought process…"
            aria-label="Optional note"
            className="glass-input flex-1 px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void save()}
            className="btn-primary py-1.5 px-4 text-xs font-semibold"
          >
            Save tag
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
