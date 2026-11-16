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

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
        {/* Dark Navy Floating Top Glass Header */}
        <header className="navy-glass-header flex items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#174c4b] to-[#252d2d] text-xs font-bold text-white shadow-xs">
              A
            </span>
            <span className="text-base font-bold text-white group-hover:text-[#c1d16b] transition-colors">
              Aptiva
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/#blueprints"
              className="text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              ← All blueprints
            </Link>
            <AuthNavCta />
          </div>
        </header>

        {/* Blueprint Container */}
        <div className="glass-sheet p-6 sm:p-10 flex flex-col gap-8 border border-[#9daeac]/35">
          <section className="flex flex-col gap-3 border-b border-[#9daeac]/30 pb-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              <span>{assessment.company}</span>
              <span>·</span>
              <span>Blueprint v{version.version}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {assessment.name}
            </h1>
            {version.lastVerifiedAt && (
              <p className="text-xs sm:text-sm text-slate-500 font-mono">
                Last verified: {new Date(version.lastVerifiedAt).toLocaleDateString()}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-5">
            <h2 className="text-xl font-bold text-slate-900">Blueprint Sections</h2>
            {version.sections.map((s) => (
              <div
                key={s.id}
                className="glass-card p-6 flex flex-col gap-4 border border-[#9daeac]/35"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#9daeac]/30 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {s.orderNo}. {s.name}
                  </h3>
                  <ProvenanceBadge source={s.source} />
                </div>

                <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4 bg-[#f0f0e9] p-3.5 rounded-xl border border-[#9daeac]/30">
                  <div>
                    <dt className="text-slate-500 font-medium font-mono text-[11px] uppercase">
                      Duration
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {s.durationMin != null ? `${s.durationMin} min` : 'unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium font-mono text-[11px] uppercase">
                      Questions
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {s.questionCountMin != null && s.questionCountMax != null
                        ? `${s.questionCountMin}–${s.questionCountMax}`
                        : 'unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium font-mono text-[11px] uppercase">
                      Negative marking
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {s.negativeMarking != null
                        ? `−${s.negativeMarking} per wrong`
                        : 'none / unknown'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium font-mono text-[11px] uppercase">
                      Format mix
                    </dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {s.formatMix
                        ? `${Math.round((s.formatMix.mcq ?? 0) * 100)}% MCQ · ${Math.round((s.formatMix.numerical ?? 0) * 100)}% numerical`
                        : 'unknown'}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h4 className="mb-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide font-mono">
                    Topic weights & coverage
                  </h4>
                  <ul className="flex flex-col gap-2">
                    {s.weights.map((w) => (
                      <li
                        key={w.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2.5 px-3.5 text-xs border border-[#9daeac]/30 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{w.topic.name}</span>
                          <span className="text-slate-500 font-mono text-[11px]">
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

          <footer className="border-t border-[#9daeac]/30 pt-5 text-xs text-slate-500">
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
