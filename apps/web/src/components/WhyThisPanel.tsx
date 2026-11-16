'use client';

import type { PlanRationale } from '../lib/content';

const SOURCE_LABEL: Record<string, string> = {
  official: 'Official source',
  public: 'Public source',
  candidate_reported: 'Candidate-reported',
  pattern_inferred: 'Pattern-inferred',
  assumption: 'Assumption (unverified)',
};

const BLOCK_LABEL: Record<string, string> = {
  concept_repair: 'Concept repair',
  targeted_practice: 'Targeted practice',
  timed_set: 'Timed set',
  formula_revision: 'Formula revision',
  mixed_check: 'Mixed check',
  speed_drill: 'Speed drill',
  short_review: 'Short review',
  maintenance: 'Maintenance',
  probe: 'Evidence probe',
};

/** P-12 Why this? — renders the stored rationale JSON as a fixed list with purple pastel styling. */
export function WhyThisPanel({ rationale }: { rationale: PlanRationale }) {
  const rows: [string, string][] = [];
  if (rationale.accuracy != null) {
    rows.push(['Recent accuracy', `${Math.round(rationale.accuracy * 100)}%`]);
  }
  if (rationale.conceptualShare != null && rationale.conceptualShare > 0) {
    rows.push(['Conceptual share of errors', `${Math.round(rationale.conceptualShare * 100)}%`]);
  }
  if (rationale.blueprintShare != null) {
    rows.push(['Blueprint share', `${Math.round(rationale.blueprintShare * 100)}%`]);
  }
  if (rationale.blueprintSource) {
    rows.push([
      'Blueprint source',
      `${SOURCE_LABEL[rationale.blueprintSource] ?? rationale.blueprintSource}${
        rationale.blueprintUnverified ? ' (unverified)' : ''
      }`,
    ]);
  }
  if (rationale.daysLeft != null) {
    rows.push(['Days left', String(rationale.daysLeft)]);
  }
  if (rationale.expectedGain != null) {
    rows.push(['Expected gain', rationale.expectedGain.toFixed(1)]);
  }
  if (rationale.wouldChangeIf) {
    rows.push(['Would change if', rationale.wouldChangeIf]);
  }
  if (rationale.extendedForBudget) {
    rows.push(['Extended for budget', `+${rationale.extendedForBudget} min`]);
  }
  return (
    <div className="mt-3 rounded-xl bg-purple-50/70 border border-purple-200/50 p-3.5 text-xs text-slate-800">
      <div className="mb-2 font-semibold text-purple-950 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-600"></span>
        Why this block was scheduled
      </div>
      {rows.length === 0 ? (
        <p className="text-slate-500">No rationale stored for this block.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500 font-medium">{k}:</dt>
              <dd className="font-semibold text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export { BLOCK_LABEL };
