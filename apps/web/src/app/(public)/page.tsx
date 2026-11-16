import Link from 'next/link';
import type { Metadata } from 'next';
import { AuthHeroCta, AuthNavCta } from '../../components/AuthCta';
import type { PublicAssessment } from '../../lib/content';
import {
  IconArrowUpRight,
  IconCompass,
  IconTarget,
  IconActivity,
  IconSparkles,
  IconClock,
  IconCheck,
} from '../../components/Icons';

export const metadata: Metadata = {
  title: 'Aptiva — Placement Aptitude Preparation That Adapts to You',
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

const TOPIC_SHELF = [
  { label: 'Quantitative Aptitude', badge: 'Math' },
  { label: 'Logical Reasoning', badge: 'Logic' },
  { label: 'Data Interpretation', badge: 'Graphs' },
  { label: 'Verbal Ability', badge: 'English' },
  { label: 'TCS NQT', badge: 'Pattern 2026' },
  { label: 'Infosys SP/DSE', badge: 'Aptitude' },
  { label: 'Cognizant GenC', badge: 'Automata' },
  { label: 'Accenture', badge: 'Cognitive' },
  { label: 'Wipro Turbo', badge: 'Elite' },
];

const STEPS = [
  {
    step: '01',
    title: 'Calibrated Diagnostic Baseline',
    tag: 'Bayesian Profile',
    body: 'A timed, mixed-format baseline across Quantitative, Logical, Data Interpretation, and Verbal. Measures precision and speed without penalizing your standing.',
    icon: IconCompass,
    detail: '27 calibrated items · 30 min duration · 1 pause allowed',
  },
  {
    step: '02',
    title: 'Knapsack Daily Study Schedule',
    tag: 'Adaptive Engine',
    body: 'A time-boxed daily schedule mathematically generated from your target exam date, daily study budgets, and topic weightings. Every single block includes the exact rationale.',
    icon: IconTarget,
    detail: 'Dynamic pacing · Rest-day protection · Priority rankings',
  },
  {
    step: '03',
    title: 'Continuous Practice & Recalibration',
    tag: 'Spaced Mastery',
    body: 'Drill sessions automatically update your topic estimates in real time. Wrong answers enter an Ebbinghaus spaced interval notebook (1d → 3d → 7d → 14d) for mastery retention.',
    icon: IconActivity,
    detail: 'Instant KaTeX solutions · Error classification · Live radar',
  },
];

const TRUST_COMPANIES = [
  'TCS NQT',
  'Infosys',
  'Cognizant',
  'Wipro',
  'Accenture',
  'Capgemini',
  'Deloitte',
  'Amazon',
];

export default async function LandingPage() {
  const assessments = await fetchAssessments();
  const featured = assessments.filter((a) => a.slug !== 'generic').slice(0, 6);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Banner Ticker (Udemy / Codecademy inspiration) */}
      <div className="banner-ticker py-2 px-4 text-center">
        <div className="mx-auto max-w-7xl flex items-center justify-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>
            <strong>2026 Campus Placement Cycle:</strong> TCS NQT, Cognizant GenC, Infosys, and
            Accenture assessment blueprints updated.
          </span>
          <a href="#blueprints" className="underline font-bold hover:text-amber-950 ml-1">
            Explore blueprints →
          </a>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-10 flex-1">
        {/* Deep Teal Floating Masthead ("The Performance Lab") */}
        <header className="navy-glass-header flex items-center justify-between px-6 py-3.5 shadow-xl">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#174c4b] via-[#1b5756] to-[#252d2d] text-sm font-semibold text-[#c1d16b] shadow-md shadow-[#174c4b]/40 border border-[#9daeac]/30 transition-transform group-hover:scale-105">
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
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-white leading-tight">
                  Aptiva
                </span>
                <span className="text-[9px] uppercase tracking-widest text-[#c1d16b] font-mono -mt-0.5">
                  Adaptive EdTech
                </span>
              </div>
            </Link>

            <span className="hidden sm:inline text-[#9daeac]/40">|</span>

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#123c3b]/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-200 border border-[#9daeac]/30 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c1d16b] animate-pulse" />
              Diagnostic Engine Live
            </span>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <a
              href="#how-it-works"
              className="hidden md:inline text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              How it works
            </a>
            <a
              href="#blueprints"
              className="hidden md:inline text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              Company Blueprints
            </a>
            <AuthNavCta />
          </nav>
        </header>

        {/* Hero Banner Section (SuperHi & Google for Education inspiration) */}
        <div className="glass-sheet p-8 sm:p-12 lg:p-16 flex flex-col gap-12 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
            <div className="flex flex-col gap-6 max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f9dc] border border-[#c1d16b] px-4 py-1.5 text-xs font-bold text-[#252d2d] w-fit shadow-2xs font-mono">
                <span className="h-2 w-2 rounded-full bg-[#174c4b] animate-pulse" />
                <span>Placement Preparation × Bayesian Intelligence</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Placement aptitude prep that starts with{' '}
                <span className="editorial-mark">what you don&apos;t know</span>.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Aptiva replaces static 1,000-question PDF dumps with a precision diagnostic engine.
                We map your baseline across every aptitude section, construct a mathematically
                calibrated daily schedule, and dynamically recalibrate your plan as you practice.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <AuthHeroCta />
                <a
                  href="#blueprints"
                  className="btn-secondary py-3 px-6 text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <span>Explore Blueprints</span>
                  <IconArrowUpRight className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Hero Visual Telemetry Card */}
            <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
              <div className="bento-card p-6 bg-gradient-to-br from-white to-[#f7f7f3] shadow-md border border-[#9daeac]/35">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-400 font-mono">
                    Adaptive Engine Telemetry
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#37420c] bg-[#f5f9dc] px-2 py-0.5 rounded-full border border-[#c1d16b]">
                    <IconSparkles className="w-3 h-3 text-[#174c4b]" />
                    Live 2026
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Average Target Readiness
                    </span>
                    <span className="stat-num text-2xl font-black text-slate-900">88–94%</span>
                  </div>
                  <div className="w-full bg-[#f0f0e9] h-2 rounded-full overflow-hidden border border-[#9daeac]/30">
                    <div className="bg-gradient-to-r from-[#174c4b] via-[#1b5756] to-[#c1d16b] h-full w-[91%] rounded-full shadow-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="rounded-xl bg-white p-3 border border-[#9daeac]/30 shadow-2xs">
                      <div className="stat-num text-lg font-bold text-slate-900">12,000+</div>
                      <div className="text-[11px] text-slate-500 font-medium">Questions Solved</div>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-[#9daeac]/30 shadow-2xs">
                      <div className="stat-num text-lg font-bold text-slate-900">4 Stages</div>
                      <div className="text-[11px] text-slate-500 font-medium">Spaced Retry</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <IconClock className="w-3.5 h-3.5 text-slate-400" />
                    30-min setup diagnostic
                  </span>
                  <span className="font-semibold text-[#174c4b]">Pausable once</span>
                </div>
              </div>
            </div>
          </div>

          {/* Topic & Assessment Discovery Shelf (SuperHi style pills) */}
          <div className="border-t border-stone-200/70 pt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Explore Syllabi &amp; Assessment Patterns
              </span>
              <span className="text-xs text-slate-500">
                Calibrated against official placement drives
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {TOPIC_SHELF.map((t) => (
                <span key={t.label} className="topic-filter-pill">
                  <span>{t.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-stone-100 px-1.5 py-0.5 rounded">
                    {t.badge}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 3 Step Interactive Workflow (Bento Layout) */}
        <section id="how-it-works" className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#9daeac]/30 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#174c4b] font-mono">
                <span>The Diagnostic Loop</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                How Aptiva gets you placement-ready.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              No generic question playlists. Every student follows an adaptive loop calibrated by
              actual accuracy and speed.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="bento-card bento-card-hover p-7 flex flex-col justify-between gap-6 group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3eceb] text-[#174c4b] font-bold border border-[#9daeac]/35 group-hover:bg-[#c1d16b]/20 group-hover:border-[#c1d16b]/60 transition-colors font-mono">
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-xs font-bold tracking-wider text-slate-400 font-mono bg-[#f0f0e9] px-2 py-0.5 rounded-full">
                        {s.step}
                      </span>
                    </div>

                    <div className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#174c4b] font-mono mb-1">
                      {s.tag}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">{s.title}</h3>
                    <p className="mt-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {s.body}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-stone-100 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <IconCheck className="w-3.5 h-3.5 text-[#174c4b]" />
                    <span>{s.detail}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Supported Assessment Blueprints Grid */}
        <section id="blueprints" className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#9daeac]/30 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#174c4b] font-mono">
                <span>Verified Exam Specifications</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Supported Company Blueprints
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Every blueprint includes verified test timings, topic weightings, difficulty bands,
              and negative marking rules.
            </p>
          </div>

          {featured.length === 0 ? (
            <div className="bento-card p-8 text-center text-xs text-slate-500">
              Blueprints are being prepared — check back soon.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((a) => (
                <Link
                  key={a.id}
                  href={`/assessments/${a.slug}`}
                  className="bento-card bento-card-hover p-6 flex flex-col justify-between gap-5 group"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-lg bg-[#e3eceb] border border-[#9daeac]/40 px-2.5 py-1 text-xs font-bold text-[#174c4b] font-mono">
                        {a.company}
                      </span>
                      <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#174c4b] transition-colors" />
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#174c4b] transition-colors mt-1">
                      {a.name}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                      <span>v{a.currentVersion?.version ?? '1.0'}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        {a.currentVersion?.lastVerifiedAt ? (
                          <span className="text-[#174c4b] font-bold">
                            ✓ Verified{' '}
                            {new Date(a.currentVersion.lastVerifiedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">Specification ready</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">View test pattern</span>
                    <span className="font-semibold text-[#174c4b] group-hover:underline">
                      Launch prep →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Company Placement Trust Bar */}
        <section className="glass-card p-8 flex flex-col items-center gap-4 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Calibrated for India&apos;s Top Campus Placement Drives
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-2 opacity-85">
            {TRUST_COMPANIES.map((company) => (
              <span key={company} className="text-sm font-bold tracking-tight text-slate-800">
                {company}
              </span>
            ))}
          </div>
        </section>

        {/* Comprehensive EdTech Footer */}
        <footer className="glass-sheet p-8 sm:p-10 border border-white/80 shadow-lg mt-4 flex flex-col gap-8 text-xs text-slate-500">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col gap-2">
              <span className="font-bold text-slate-900">Aptiva Learning</span>
              <p className="text-[11px] leading-relaxed">
                Adaptive diagnostic, study planning, and spaced retention workspace for competitive
                placement assessments.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-bold text-slate-900">Student Tools</span>
              <Link href="/login" className="hover:text-slate-900">
                Sign in to Dashboard
              </Link>
              <Link href="/register" className="hover:text-slate-900">
                Create Free Account
              </Link>
              <Link href="/onboarding/diagnostic" className="hover:text-slate-900">
                Setup Diagnostic
              </Link>
              <Link href="/reset-password" className="hover:text-slate-900">
                Forgot Password
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-bold text-slate-900">Workspaces</span>
              <Link href="/practice" className="hover:text-slate-900">
                Practice Drills
              </Link>
              <Link href="/plan" className="hover:text-slate-900">
                Daily Knapsack Plan
              </Link>
              <Link href="/notebook" className="hover:text-slate-900">
                Spaced Mistake Notebook
              </Link>
              <Link href="/billing" className="hover:text-slate-900">
                Placement Passes
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-bold text-slate-900">Legal &amp; Policy</span>
              <Link href="/privacy" className="hover:text-slate-900">
                Privacy Policy &amp; Data Rights
              </Link>
              <span>Independent EdTech SaaS</span>
              <span>Not affiliated with assessment providers</span>
            </div>
          </div>

          <div className="border-t border-stone-200/60 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <span>
              &copy; {new Date().getFullYear()} Aptiva Adaptive Learning System. All rights
              reserved.
            </span>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <Link href="/login" className="hover:underline">
                Student Login
              </Link>
              <Link href="/admin" className="hover:underline font-semibold text-slate-700">
                Admin Portal
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
