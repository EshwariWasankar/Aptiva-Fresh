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

/** P-12 Why this? — renders the stored rationale JSON as a fixed list. */
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
    <div className="mt-2 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
      <div className="mb-1 font-medium">Why this?</div>
      {rows.length === 0 ? (
        <p className="text-neutral-500">No rationale stored for this block.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-neutral-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export { BLOCK_LABEL };
