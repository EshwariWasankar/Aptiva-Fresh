import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProvenanceBadge } from '../../../../components/ProvenanceBadge';
import type { PublicBlueprint } from '../../../../lib/content';
import { AuthNavCta } from '../../../../components/AuthCta';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const bp = await fetchBlueprint(slug);
  if (!bp) return { title: 'Assessment — Aptiva' };
  return {
    title: `${bp.assessment.name} blueprint — Aptiva`,
    description: `Sections, durations, question counts and topic weights for ${bp.assessment.name}, with per-field provenance.`,
  };
}

async function fetchBlueprint(slug: string): Promise<PublicBlueprint | null> {
  try {
    const res = await fetch(`${API}/api/v1/assessments/${encodeURIComponent(slug)}/blueprint`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: PublicBlueprint };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export default async function BlueprintPage({ params }: Params) {
  const { slug } = await params;
  const bp = await fetchBlueprint(slug);
  if (!bp) notFound();

  const { assessment, version } = bp;
  const anyUnverified = version.sections.some(
    (s) =>
      !s.source ||
      s.source.sourceType === 'assumption' ||
      s.source.confidence === 'low' ||
      s.weights.some((w) => !w.source || w.source.sourceType === 'assumption'),
  );

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Floating Top Glass Header */}
        <header className="glass-header flex items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-2xs">
              A
            </span>
            <span className="text-base font-bold text-stone-900 group-hover:text-blue-600 transition-colors">
              Aptiva
            </span>
          </Link>
          <AuthNavCta />
        </header>

        {/* Blueprint Container */}
        <div className="glass-sheet p-6 sm:p-10 flex flex-col gap-8">
          <section className="flex flex-col gap-3 border-b border-stone-200/50 pb-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              <span>{assessment.company}</span>
              <span>·</span>
              <span>Blueprint v{version.version}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-stone-900">
              {assessment.name}
            </h1>
            <p className="text-xs sm:text-sm text-stone-500">
              {version.lastVerifiedAt
                ? `Last verified: ${new Date(version.lastVerifiedAt).toLocaleDateString()}`
                : 'Never verified against real exam cycle'}
            </p>
            {anyUnverified && (
              <div className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-900">
                Some fields in this blueprint are unverified or inferred — check the provenance
                badge on each field before relying on it.
              </div>
            )}
          </section>

          <section className="flex flex-col gap-5">
            <h2 className="text-xl font-bold text-stone-900">Blueprint Sections</h2>
            {version.sections.map((s) => (
              <div key={s.id} className="glass-card p-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <h3 className="text-base font-bold text-stone-900">
                    {s.orderNo}. {s.name}
                  </h3>
                  <ProvenanceBadge source={s.source} />
                </div>

                <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4 bg-stone-50/80 p-3.5 rounded-xl border border-stone-200/40">
                  <div>
                    <dt className="text-stone-400 font-medium">Duration</dt>
                    <dd className="font-semibold text-stone-800 mt-0.5">
                      {s.durationMin != null ? `${s.durationMin} min` : 'unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400 font-medium">Questions</dt>
                    <dd className="font-semibold text-stone-800 mt-0.5">
                      {s.questionCountMin != null && s.questionCountMax != null
                        ? `${s.questionCountMin}–${s.questionCountMax}`
                        : 'unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400 font-medium">Negative marking</dt>
                    <dd className="font-semibold text-stone-800 mt-0.5">
                      {s.negativeMarking != null
                        ? `−${s.negativeMarking} per wrong`
                        : 'none / unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-stone-400 font-medium">Format mix</dt>
                    <dd className="font-semibold text-stone-800 mt-0.5">
                      {s.formatMix
                        ? `${Math.round((s.formatMix.mcq ?? 0) * 100)}% MCQ · ${Math.round((s.formatMix.numerical ?? 0) * 100)}% numerical`
                        : 'unknown'}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h4 className="mb-2.5 text-xs font-semibold text-stone-600 uppercase tracking-wide">
                    Topic weights & coverage
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {s.weights.map((w) => (
                      <li
                        key={w.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 p-2.5 px-3.5 text-xs border border-stone-200/50 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{w.topic.name}</span>
                          <span className="text-stone-500">
                            ({Math.round(w.share * 100)}%
                            {w.difficultyBand ? ` · band ${w.difficultyBand}` : ''}
                            {w.paceSeconds ? ` · ~${Math.round(w.paceSeconds / 60)} min pace` : ''})
                          </span>
                        </div>
                        <ProvenanceBadge source={w.source} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </section>

          <footer className="border-t border-stone-200/50 pt-5 text-xs text-stone-500">
            <p>
              Aptiva is an independent study tool. It is not affiliated with, endorsed by, or
              connected to {assessment.company} or any assessment provider. Blueprint details are
              compiled from the sources shown and may be incomplete or out of date.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
