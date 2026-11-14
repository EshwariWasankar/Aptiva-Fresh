'use client';

/**
 * ConflictNote — shown when the student's reported error cause disagrees
 * with the rule-based inference (T-010, FR-006). Dismissible; the stored
 * label is always the student's report.
 */
export function ConflictNote({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900 shadow-2xs">
      <span>
        Your report differs from the observed pattern (very fast or slow answer). Both data points
        are kept — your label is what we store and prioritize in your plan.
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss note"
          className="text-amber-800 font-semibold hover:underline shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
