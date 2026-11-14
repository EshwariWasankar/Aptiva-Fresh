'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { PasswordInput } from './PasswordInput';
import { ApiError, register } from '../lib/apiClient';
import { useSession } from '../lib/session';

// Must match NOTICE_VERSION on the API (PH1-T06 consent versioning).
export const CONSENT_NOTICE_VERSION = '2026-11';

const RegisterSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(10, 'Password must be at least 10 characters'),
  gradYear: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 1990 && Number(v) <= 2100), 'Invalid year'),
  branch: z.string().max(120).optional(),
  college: z.string().max(200).optional(),
  consent: z.literal(true, { error: 'Consent is required' }),
});

function strengthHint(pw: string): string {
  if (pw.length === 0) return '';
  if (pw.length < 10) return 'At least 10 characters required';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) return 'Strong password';
  if (classes === 2) return 'Good — add more variety for a stronger password';
  return 'Weak — mix letters, numbers and symbols';
}

/** P-03 registration form (FR-001). */
export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [branch, setBranch] = useState('');
  const [college, setCollege] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { reload } = useSession();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = RegisterSchema.safeParse({
      email,
      password,
      gradYear: gradYear || undefined,
      branch: branch || undefined,
      college: college || undefined,
      consent,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path[0] as string] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await register({
        email: parsed.data.email,
        password: parsed.data.password,
        gradYear: parsed.data.gradYear ? Number(parsed.data.gradYear) : undefined,
        branch: parsed.data.branch || undefined,
        college: parsed.data.college || undefined,
        consentVersion: CONSENT_NOTICE_VERSION,
      });
      await reload();
      router.replace('/dashboard');
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.status === 409
          ? 'An account with this email already exists. Try signing in.'
          : 'Registration failed. Please check your details and try again.',
      );
    } finally {
      setPending(false);
    }
  }

  const hint = strengthHint(password);

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
        {errors.email ? (
          <span className="text-[11px] font-medium text-rose-600">{errors.email}</span>
        ) : null}
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        Password
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        {hint ? <span className="text-[11px] text-stone-500">{hint}</span> : null}
        {errors.password ? (
          <span className="text-[11px] font-medium text-rose-600">{errors.password}</span>
        ) : null}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
          Graduation year
          <input
            type="number"
            min={1990}
            max={2100}
            value={gradYear}
            onChange={(e) => setGradYear(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-sm"
            placeholder="2026"
          />
          {errors.gradYear ? (
            <span className="text-[11px] font-medium text-rose-600">{errors.gradYear}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
          Branch
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="glass-input px-3.5 py-2.5 text-sm"
            placeholder="CSE / IT / ECE"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-stone-700">
        College (optional)
        <input
          type="text"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          className="glass-input px-3.5 py-2.5 text-sm"
          placeholder="University / Institute name"
        />
      </label>
      <label className="flex items-start gap-2.5 text-xs text-stone-600 pt-1">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
        />
        <span>
          I agree to the{' '}
          <Link href="/privacy" className="text-blue-600 underline">
            privacy notice
          </Link>{' '}
          (version {CONSENT_NOTICE_VERSION}).
        </span>
      </label>
      {errors.consent ? (
        <span className="text-[11px] font-medium text-rose-600">{errors.consent}</span>
      ) : null}
      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800"
        >
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-1 py-2.5 px-4 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <div className="flex justify-between text-xs text-stone-600 mt-1">
        <span>Already have an account?</span>
        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition">
          Sign in
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
