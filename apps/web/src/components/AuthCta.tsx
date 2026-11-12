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
    return <span className="text-sm text-neutral-400">…</span>;
  }
  if (user) {
    return (
      <span className="flex items-center gap-4 text-sm">
        <span className="text-neutral-500">{user.email}</span>
        <Link href="/dashboard" className="font-medium text-neutral-900 hover:underline">
          Dashboard
        </Link>
        <button
          type="button"
          onClick={() => void signOut().then(() => (window.location.href = '/'))}
          className="text-neutral-600 underline"
        >
          Sign out
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-4 text-sm">
      <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
        Sign in
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
      >
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
      <div className="mt-2 flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-neutral-900 px-5 py-2.5 text-white hover:bg-neutral-700"
        >
          Go to dashboard
        </Link>
        <a href={assessmentsHref} className="rounded-md border px-5 py-2.5 hover:bg-neutral-100">
          See supported assessments
        </a>
      </div>
    );
  }
  return (
    <div className="mt-2 flex gap-3">
      <Link
        href="/register"
        className="rounded-md bg-neutral-900 px-5 py-2.5 text-white hover:bg-neutral-700"
      >
        Create free account
      </Link>
      <a href={assessmentsHref} className="rounded-md border px-5 py-2.5 hover:bg-neutral-100">
        See supported assessments
      </a>
    </div>
  );
}
