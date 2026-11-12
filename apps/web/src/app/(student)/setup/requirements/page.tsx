import type { Metadata } from 'next';
import { RequirementsForm } from '../../../../components/RequirementsForm';

export const metadata: Metadata = { title: 'Requirements — Aptiva' };

export default function RequirementsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preparation requirements</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tell us your test date and available time — we&apos;ll build a time-boxed plan with
          reasons for every block.
        </p>
      </div>
      <RequirementsForm />
    </div>
  );
}
