import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy notice — Aptiva' };

/**
 * Draft privacy notice placeholder. Final text is a PH-10 deliverable
 * (PH10-T08: reviewed by counsel). Consent records store NOTICE_VERSION
 * from the API env; keep this page's version label in sync.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center">
      <main className="w-full max-w-2xl">
        <div className="glass-sheet p-8 sm:p-10 flex flex-col gap-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-stone-200/50 pb-4">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm shadow-xs"
            >
              A
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Privacy notice</h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Draft placeholder (notice version 2026-11). Aptiva stores your account details,
            assessment answers, plans and error reports to provide the service. You can export or
            delete your data at any time from your account settings. The final notice is published
            after formal review.
          </p>
          <div className="pt-2 border-t border-stone-200/40">
            <Link href="/" className="btn-secondary py-2 px-4 text-xs font-medium inline-block">
              Back to Aptiva
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
