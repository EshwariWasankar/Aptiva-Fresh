import { RequirementsForm } from '../../../../components/RequirementsForm';

export const metadata = { title: 'Requirements — Aptiva' };

export default function RequirementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-stone-200/50 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Preparation Requirements &amp; Pacing
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Specify your test date, daily study time budgets, and target company assessment to
          construct an adaptive knapsack plan.
        </p>
      </div>
      <RequirementsForm />
    </div>
  );
}
