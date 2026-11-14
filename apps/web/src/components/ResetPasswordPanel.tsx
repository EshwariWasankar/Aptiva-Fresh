'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { api, ApiError } from '../lib/apiClient';
import { PasswordInput } from './PasswordInput';

const RequestSchema = z.object({ email: z.string().email('Enter a valid email') });
const ConfirmSchema = z.object({
  password: z.string().min(10, 'Password must be at least 10 characters'),
  confirm: z.string(),
});

/** P-05b: request a reset link, or confirm with ?token=. */
function ResetPasswordInner() {
  const params = useSearchParams();
  const token = params.get('token');

  if (token) return <ResetConfirm token={token} />;
  return <ResetRequest />;
}

function ResetRequest() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = RequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api<null>('/auth/password-reset/request', {
        method: 'POST',
        body: { email: parsed.data.email },
        auth: false,
      });
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-blue-50/80 border border-blue-200/60 p-4 text-xs text-blue-900 leading-relaxed">
        If an account exists for that email, a reset link is on its way. Check your inbox and spam
        folder.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">Reset password</h1>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input px-3.5 py-2.5 text-sm"
          placeholder="you@college.edu"
        />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary py-2.5 px-4 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <Link
        href="/login"
        className="text-xs text-stone-500 hover:text-blue-600 transition text-center"
      >
        Back to sign in
      </Link>
    </form>
  );
}

function ResetConfirm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = ConfirmSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    if (parsed.data.password !== parsed.data.confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api<null>('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, password: parsed.data.password },
        auth: false,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 410
          ? 'This reset link has expired. Request a new one.'
          : 'This reset link is invalid or has already been used.',
      );
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-sm font-medium text-stone-800">Password updated. You can sign in now.</p>
        <Link href="/login" className="btn-primary py-2.5 px-4 text-sm font-semibold">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-bold tracking-tight text-stone-900">Choose a new password</h1>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        New password
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        Confirm password
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </label>
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800"
        >
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary py-2.5 px-4 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

export function ResetPasswordPanel() {
  return (
    <Suspense fallback={<p className="text-xs text-stone-400">Loading…</p>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
