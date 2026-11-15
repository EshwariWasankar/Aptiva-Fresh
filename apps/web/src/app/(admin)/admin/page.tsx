import Link from 'next/link';
import {
  IconArrowUpRight,
  IconBook,
  IconTarget,
  IconActivity,
  IconLayers,
} from '../../../components/Icons';

export const metadata = { title: 'Admin — Aptiva' };

export default function AdminPage() {
  const tools = [
    {
      href: '/admin/questions',
      title: 'Question Bank',
      desc: 'Browse, create, and edit question items across all topics.',
      icon: IconBook,
    },
    {
      href: '/admin/import',
      title: 'CSV Question Import',
      desc: 'Batch ingest questions with validation against blueprint schemas.',
      icon: IconLayers,
    },
    {
      href: '/admin/blueprints',
      title: 'Assessment Blueprints',
      desc: 'Configure company assessments, durations, and topic distributions.',
      icon: IconTarget,
    },
    {
      href: '/admin/review',
      title: 'Item Review Queue',
      desc: 'Two-stage peer review and editorial approval workflow.',
      icon: IconActivity,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-purple-100/60 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Admin Control Center
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Curate question banks, manage assessment blueprints, review contributor submissions, and
          run imports.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="glass-card glass-card-interactive p-6 flex flex-col justify-between gap-4 group"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100 group-hover:bg-purple-100/70 transition-colors">
                  <Icon className="w-4 h-4" />
                </span>
                <IconArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                  {t.title}
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{t.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
