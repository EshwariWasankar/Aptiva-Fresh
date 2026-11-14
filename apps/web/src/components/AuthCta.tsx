'use client';

import Link from 'next/link';
import { useSession } from '../lib/session';

/**
 * Auth-aware calls-to-action for public pages. While the session is still
 * loading we render the anonymous variant to avoid a flash of wrong CTA.
 */
export function AuthNavCta() {
  const { user, loading, signOut } = useSession();
  if (loading) {
    return <span className="text-xs text-stone-400">…</span>;
  }
  if (user) {
    return (
      <span className="flex items-center gap-3 text-xs">
        <span className="text-stone-500 hidden sm:inline">{user.email}</span>
        <Link
          href="/dashboard"
          className="btn-primary px-3.5 py-1.5 text-xs font-semibold shadow-xs"
        >
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => void signOut().then(() => (window.location.href = '/'))}
          className="text-stone-500 hover:text-stone-800 transition"
        >
          Sign out
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-3 text-xs">
      <Link
        href="/login"
        className="font-medium text-stone-600 hover:text-stone-900 transition px-2 py-1"
      >
        Sign in
      </Link>
      <Link href="/register" className="btn-primary px-4 py-2 text-xs font-semibold shadow-xs">
        Get started
      </Link>
    </span>
  );
}

export function AuthHeroCta({ assessmentsHref = '#blueprints' }: { assessmentsHref?: string }) {
  const { user, loading } = useSession();
  if (loading) return null;
  if (user) {
    return (
      <div className="mt-2 flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="btn-primary px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
        >
          <span>Go to dashboard</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <a href={assessmentsHref} className="btn-secondary px-5 py-2.5 text-sm font-medium">
          See supported assessments
        </a>
      </div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap gap-3">
      <Link
        href="/register"
        className="btn-primary px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"
      >
        <span>Create free account</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </Link>
      <a href={assessmentsHref} className="btn-secondary px-5 py-2.5 text-sm font-medium">
        See supported assessments
      </a>
    </div>
  );
}
