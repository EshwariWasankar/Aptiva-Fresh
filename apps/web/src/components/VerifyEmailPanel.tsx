'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '../lib/apiClient';

/** P-05a: consume ?token= from the verification email link. */
function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Missing verification token.');
      return;
    }
    setState('working');
    api<null>('/auth/verify-email', { method: 'POST', body: { token }, auth: false })
      .then(() => {
        setState('done');
        setMessage('Email verified. You can now sign in.');
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(
          err instanceof ApiError && err.status === 410
            ? 'This verification link has expired. Request a new one from your account settings.'
            : 'This verification link is invalid or has already been used.',
        );
      });
  }, [token]);

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="text-xl font-bold tracking-tight text-stone-900">Verify email</h1>
      <p className="text-xs text-stone-600 leading-relaxed">
        {state === 'working' && 'Verifying your token…'}
        {state === 'done' && <span className="text-emerald-700 font-medium">{message}</span>}
        {state === 'error' && <span className="text-rose-700">{message}</span>}
        {state === 'idle' && ''}
      </p>
      <Link
        href="/login"
        className="btn-primary mt-2 py-2.5 px-4 text-xs font-semibold inline-block"
      >
        Go to sign in
      </Link>
    </div>
  );
}

export function VerifyEmailPanel() {
  return (
    <Suspense fallback={<p className="text-xs text-stone-400">Loading…</p>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
