'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, login } from '../lib/apiClient';
import { useSession } from '../lib/session';
import { PasswordInput } from './PasswordInput';

/** P-04 login form. Error text is deliberately generic (SEC-003). */
export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { reload } = useSession();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      await reload();
      router.replace('/dashboard');
    } catch (err) {
      // Generic message regardless of cause — never reveal which field failed.
      setError(
        !(err instanceof ApiError)
          ? 'Cannot reach the server — check your connection and try again.'
          : err.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : 'Invalid email or password.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input px-3.5 py-2.5 text-sm"
          placeholder="you@college.edu"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        Password
        <PasswordInput value={password} onChange={setPassword} />
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
        className="btn-primary mt-1 py-2.5 px-4 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <div className="flex justify-between text-xs text-stone-600 mt-1">
        <Link href="/reset-password" className="hover:text-blue-600 transition">
          Forgot password?
        </Link>
        <Link href="/register" className="font-medium hover:text-blue-600 transition">
          Create account
        </Link>
      </div>
      <div className="relative my-2 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200"></div>
        </div>
        <span className="relative bg-white/70 px-3 text-[11px] text-stone-400">or</span>
      </div>
      <a
        href="/api/v1/auth/google"
        className="btn-secondary py-2.5 px-4 text-center text-xs font-medium flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Continue with Google</span>
      </a>
    </form>
  );
}
