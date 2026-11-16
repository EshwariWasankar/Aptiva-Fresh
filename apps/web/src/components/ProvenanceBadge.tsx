import type { ProvenanceSource } from '../lib/content';

const TYPE_LABEL: Record<string, string> = {
  official: 'Official',
  public: 'Public',
  candidate_reported: 'Candidate-reported',
  pattern_inferred: 'Pattern-inferred',
  assumption: 'Assumption',
};

const CONFIDENCE_STYLE: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-800 border border-emerald-200/60',
  medium: 'bg-amber-50 text-amber-800 border border-amber-200/60',
  low: 'bg-slate-100 text-slate-700 border border-slate-200/60',
};

/** Provenance badge + last-verified date (P-02 requirement) with purple & pastel styling. */
export function ProvenanceBadge({ source }: { source: ProvenanceSource | null }) {
  if (!source) {
    return <span className="text-xs text-slate-400">No source recorded</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="rounded-full bg-[#e3eceb] px-2.5 py-0.5 font-bold text-[#174c4b] border border-[#9daeac]/40 font-mono">
        {TYPE_LABEL[source.sourceType] ?? source.sourceType}
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 font-medium ${CONFIDENCE_STYLE[source.confidence] ?? ''}`}
      >
        {source.confidence} confidence
      </span>
      {source.lastVerifiedAt ? (
        <span className="text-slate-500">
          verified {new Date(source.lastVerifiedAt).toLocaleDateString()}
        </span>
      ) : (
        <span className="text-amber-800 font-medium">never verified</span>
      )}
      {source.reference ? (
        <span className="max-w-56 truncate text-slate-400" title={source.reference}>
          · {source.reference}
        </span>
      ) : null}
    </span>
  );
}
