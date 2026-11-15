import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthHeroCta, AuthNavCta } from '../../components/AuthCta';
import type { PublicAssessment } from '../../lib/content';
import { IconArrowUpRight, IconCompass, IconTarget, IconActivity } from '../../components/Icons';

export const metadata: Metadata = {
  title: 'Aptiva — placement aptitude preparation that adapts to you',
  description:
    'A diagnostic-driven study planner for campus placement aptitude tests. Know your weak topics, get a time-boxed daily plan, and practise what matters.',
};

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function fetchAssessments(): Promise<PublicAssessment[]> {
  try {
    const res = await fetch(`${API}/api/v1/assessments`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: PublicAssessment[] };
    return body.data ?? [];
  } catch {
    return [];
  }
}

const STEPS = [
  {
    step: '1',
    title: 'Take the diagnostic',
    body: 'A timed, mixed-format baseline across Quant, Logical Reasoning, Data Interpretation and Verbal — about 30 minutes, pausable once.',
    icon: IconCompass,
  },
  {
    step: '2',
    title: 'Get your plan',
    body: 'A time-boxed daily schedule built from your profile and your target assessment blueprint — with the reasoning behind every block.',
    icon: IconTarget,
  },
  {
    step: '3',
    title: 'Practise and recalibrate',
    body: 'Session feedback updates your profile continuously; the plan adapts as your readiness changes.',
    icon: IconActivity,
  },
];

export default async function LandingPage() {
  const assessments = await fetchAssessments();
  const featured = assessments.filter((a) => a.slug !== 'generic').slice(0, 4);

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-8">
        {/* Dark Navy Floating Top Header */}
        <header className="navy-glass-header flex items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-semibold text-white shadow-md shadow-purple-500/20">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
                <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
                <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
              </svg>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">Aptiva</span>
              <span className="hidden sm:inline text-slate-600">|</span>
              <span className="hidden sm:inline text-xs text-slate-300 font-medium">
                Adaptive Placement Workspace
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <AuthNavCta />
          </nav>
        </header>

        {/* Hero & Content Inside Glass Sheet */}
        <div className="glass-sheet p-8 sm:p-12 flex flex-col gap-12">
          {/* Hero Section */}
          <section className="flex flex-col gap-5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-50/90 border border-purple-200/80 px-3.5 py-1 text-xs font-semibold text-purple-700 w-fit shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse"></span>
              Diagnostic-Driven Placement Engine
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
              Placement prep that starts with what you don&apos;t know.
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Aptiva runs a calibrated setup diagnostic, maps your precision baseline across
              aptitude topics, and generates a time-boxed practice plan mathematically tuned to the
              company assessment you&apos;re targeting.
            </p>
            <div className="pt-2">
              <AuthHeroCta />
            </div>
          </section>

          {/* 3 Step Cards */}
          <section className="grid gap-5 sm:grid-cols-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="glass-card p-6 flex flex-col justify-between gap-4 group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-bold text-xs border border-purple-100 group-hover:bg-purple-100/70 transition-colors">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                        Step {s.step}
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-slate-900 mb-2">{s.title}</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Blueprints Section */}
          <section
            id="blueprints"
            className="flex flex-col gap-5 pt-4 border-t border-purple-100/60"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Supported Assessment Blueprints
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Every blueprint lists tested sections, exact timings, topic weightings, and real
                  verification dates.
                </p>
              </div>
            </div>

            {featured.length === 0 ? (
              <div className="glass-card p-6 text-center text-xs text-slate-500">
                Blueprints are being prepared — check back soon.
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {featured.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/assessments/${a.slug}`}
                      className="glass-card glass-card-interactive p-5 flex items-center justify-between group block"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                          {a.name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-700">{a.company}</span>
                          <span>·</span>
                          <span>v{a.currentVersion?.version ?? '?'}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            {a.currentVersion?.lastVerifiedAt ? (
                              <span className="text-emerald-700 font-medium">
                                ✓ verified{' '}
                                {new Date(a.currentVersion.lastVerifiedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">unverified</span>
                            )}
                          </span>
                        </div>
                      </div>
                      <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors shrink-0 ml-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="border-t border-purple-100/60 pt-6 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Aptiva is an independent adaptive study system. Not affiliated with or endorsed by any
              assessment provider.
            </span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/login" className="hover:underline">
                Sign in
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
