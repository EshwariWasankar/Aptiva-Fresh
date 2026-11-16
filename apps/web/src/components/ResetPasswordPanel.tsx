'use client';

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { api, ApiError } from '../lib/apiClient';
import { PasswordInput } from './PasswordInput';

const EmailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const PasswordSchema = z
  .object({
    password: z.string().min(10, 'Password must be at least 10 characters'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

type Step = 'email' | 'otp' | 'password' | 'success';

function ResetPasswordInner() {
  const params = useSearchParams();
  const legacyToken = params.get('token');

  // If a legacy ?token= URL was opened, maintain support for the direct link reset
  if (legacyToken) {
    return <LegacyResetConfirm token={legacyToken} />;
  }

  return <OtpPasswordResetFlow />;
}

export function ResetPasswordPanel() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-400 text-center py-8">Loading…</p>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

/** 4-Step OTP Password Reset Wizard */
function OtpPasswordResetFlow() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Manage 60-second resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  return (
    <div className="flex flex-col gap-6">
      {/* Progress Stepper */}
      {step !== 'success' && (
        <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
          {[
            { id: 'email', label: 'Email' },
            { id: 'otp', label: 'Verify' },
            { id: 'password', label: 'New Password' },
          ].map((item, idx) => {
            const isCurrent = step === item.id;
            const isCompleted =
              (item.id === 'email' && (step === 'otp' || step === 'password')) ||
              (item.id === 'otp' && step === 'password');

            return (
              <div key={item.id} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isCompleted
                      ? 'bg-[#c1d16b] text-[#252d2d] font-bold shadow-xs'
                      : isCurrent
                        ? 'bg-[#174c4b] text-white shadow-xs ring-2 ring-[#c1d16b]'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:inline ${
                    isCurrent
                      ? 'text-[#174c4b] font-bold'
                      : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
                {idx < 2 && <div className="w-6 sm:w-10 h-0.5 bg-slate-100 mx-1" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step Components */}
      {step === 'email' && (
        <StepEmail
          initialEmail={email}
          onSuccess={(submittedEmail, initialCooldown) => {
            setEmail(submittedEmail);
            setCooldown(initialCooldown || 60);
            setStep('otp');
          }}
        />
      )}

      {step === 'otp' && (
        <StepOtp
          email={email}
          cooldown={cooldown}
          onResend={() => setCooldown(60)}
          onChangeEmail={() => setStep('email')}
          onVerified={(token) => {
            setResetToken(token);
            setStep('password');
          }}
        />
      )}

      {step === 'password' && (
        <StepPassword
          resetToken={resetToken}
          onSuccess={() => setStep('success')}
          onExpired={() => setStep('email')}
        />
      )}

      {step === 'success' && <StepSuccess />}
    </div>
  );
}

// ------------------------------------------------------------- Step 1: Email

function StepEmail({
  initialEmail,
  onSuccess,
}: {
  initialEmail: string;
  onSuccess: (email: string, cooldown: number) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = EmailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid email address');
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await api<{ success: boolean; message: string; cooldownSeconds?: number }>(
        '/auth/password-reset/otp/request',
        {
          method: 'POST',
          body: { email: result.data.email },
          auth: false,
        },
      );
      onSuccess(result.data.email, response?.cooldownSeconds ?? 60);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'COOLDOWN_ACTIVE') {
        setError(err.message);
      } else if (err instanceof ApiError && err.code === 'EMAIL_DELIVERY_FAILED') {
        setError(err.message);
      } else if (err instanceof ApiError && err.status === 429) {
        setError('Too many requests. Please wait a minute and try again.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to send code right now. Please check your connection and try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Forgot password</h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Enter your registered email address and we will send a 6-digit verification code to reset
          your password.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        Registered Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="glass-input px-3.5 py-2.5 text-sm"
          placeholder="you@college.edu"
          autoFocus
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800 flex items-start gap-2"
        >
          <span className="font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary py-2.5 px-4 text-sm font-semibold disabled:opacity-50 mt-1"
      >
        {pending ? 'Sending verification code…' : 'Send verification code'}
      </button>

      <div className="flex justify-center text-xs text-slate-500 mt-2">
        <Link
          href="/login"
          className="text-[#174c4b] hover:underline transition flex items-center gap-1 font-semibold"
        >
          ← Back to sign in
        </Link>
      </div>
    </form>
  );
}

// ------------------------------------------------------------- Step 2: OTP Verification

function StepOtp({
  email,
  cooldown,
  onResend,
  onChangeEmail,
  onVerified,
}: {
  email: string;
  cooldown: number;
  onResend: () => void;
  onChangeEmail: () => void;
  onVerified: (resetToken: string) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first empty digit or the first digit on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(index: number, val: string) {
    const char = val.replace(/\D/g, '').slice(-1);
    const updated = [...digits];
    updated[index] = char;
    setDigits(updated);
    setError(null);

    // Auto-advance to next input if filled
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;

    const updated = [...digits];
    for (let i = 0; i < 6; i++) {
      updated[i] = paste[i] || '';
    }
    setDigits(updated);
    setError(null);

    const nextIndex = Math.min(paste.length, 5);
    inputRefs.current[nextIndex]?.focus();
  }

  async function handleVerify(e?: FormEvent) {
    if (e) e.preventDefault();
    const otp = digits.join('');
    if (otp.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await api<{ success: boolean; resetToken: string }>(
        '/auth/password-reset/otp/verify',
        {
          method: 'POST',
          body: { email, otp },
          auth: false,
        },
      );
      if (response?.resetToken) {
        onVerified(response.resetToken);
      } else {
        setError('Verification succeeded but no authorization token received.');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Verification failed. Please check your code and try again.');
      }
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await api<{ success: boolean }>('/auth/password-reset/otp/request', {
        method: 'POST',
        body: { email },
        auth: false,
      });
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      onResend();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not resend code. Please wait a moment and try again.');
      }
    } finally {
      setResending(false);
    }
  }

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-5" noValidate>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Verify your identity</h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          We sent a 6-digit code to <span className="font-semibold text-slate-800">{email}</span>.
          The code expires in 5 minutes.
        </p>
      </div>

      {/* 6 Digit Input Boxes */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-700">Enter 6-digit code</label>
        <div className="flex justify-between gap-2 sm:gap-3" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-11 h-12 sm:w-12 sm:h-13 text-center text-lg font-bold glass-input rounded-xl focus:ring-2 focus:ring-[#174c4b] focus:border-[#174c4b] transition-all select-all"
              autoComplete="one-time-code"
              aria-label={`Digit ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800 flex items-start gap-2"
        >
          <span className="font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!isComplete || pending}
        className="btn-primary py-2.5 px-4 text-sm font-semibold disabled:opacity-50 mt-1"
      >
        {pending ? 'Verifying code…' : 'Verify & continue'}
      </button>

      {/* Resend and change email options */}
      <div className="flex flex-col gap-2 text-center text-xs text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span>Didn&apos;t receive code?</span>
          {cooldown > 0 ? (
            <span className="text-slate-400 font-medium cursor-not-allowed">
              Resend in {cooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[#174c4b] hover:underline font-bold transition disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-slate-500 hover:text-slate-800 transition text-left text-[11px]"
        >
          ← Wrong email? Use a different address
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------- Step 3: New Password

function StepPassword({
  resetToken,
  onSuccess,
  onExpired,
}: {
  resetToken: string;
  onSuccess: () => void;
  onExpired: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hasMinLength = password.length >= 10;
  const isMatch = password === confirm && confirm.length > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = PasswordSchema.safeParse({ password, confirm });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid password input');
      return;
    }

    setError(null);
    setPending(true);

    try {
      await api<{ success: boolean }>('/auth/password-reset/otp/reset', {
        method: 'POST',
        body: { resetToken, password: result.data.password },
        auth: false,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_RESET_TOKEN') {
          setError('Your reset authorization has expired. Please restart the verification.');
          setTimeout(() => onExpired(), 3000);
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to update password. Please try again.');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Set new password</h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Create a secure new password for your Aptiva account.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        New Password
        <PasswordInput
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          autoComplete="new-password"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        Confirm New Password
        <PasswordInput
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setError(null);
          }}
          autoComplete="new-password"
        />
      </label>

      {/* Real-time Password Checklist */}
      <div className="rounded-xl bg-slate-50/80 border border-slate-200/60 p-3 flex flex-col gap-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={hasMinLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
            {hasMinLength ? '✓' : '○'}
          </span>
          <span className={hasMinLength ? 'text-slate-700 font-medium' : 'text-slate-500'}>
            At least 10 characters
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={isMatch ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
            {isMatch ? '✓' : '○'}
          </span>
          <span className={isMatch ? 'text-slate-700 font-medium' : 'text-slate-500'}>
            Passwords match
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <span>🔒</span>
          <span>Checked against known data breaches (HIBP)</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800 flex items-start gap-2"
        >
          <span className="font-bold">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!hasMinLength || !isMatch || pending}
        className="btn-primary py-2.5 px-4 text-sm font-semibold disabled:opacity-50 mt-1"
      >
        {pending ? 'Saving new password…' : 'Update password'}
      </button>
    </form>
  );
}

// ------------------------------------------------------------- Step 4: Success

function StepSuccess() {
  return (
    <div className="flex flex-col items-center text-center gap-4 py-2">
      <div className="h-14 w-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl text-emerald-600 shadow-sm shadow-emerald-500/10">
        ✓
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Password reset complete</h1>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs mx-auto">
          Your password has been successfully updated. All previous sessions have been safely signed
          out. You can now log in with your new password.
        </p>
      </div>

      <Link
        href="/login"
        className="btn-primary w-full py-2.5 px-4 text-sm font-semibold text-center mt-2 shadow-md shadow-[#174c4b]/20"
      >
        Sign in to your account
      </Link>
    </div>
  );
}

// ------------------------------------------------------------- Legacy direct-link support

function LegacyResetConfirm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 10) {
      setError('Password must be at least 10 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api<null>('/auth/password-reset/confirm', {
        method: 'POST',
        body: { token, password },
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
      <div className="flex flex-col gap-4 text-center items-center py-2">
        <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl text-emerald-600">
          ✓
        </div>
        <p className="text-sm font-medium text-slate-800">Password updated. You can sign in now.</p>
        <Link href="/login" className="btn-primary w-full py-2.5 px-4 text-sm font-semibold">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        New password
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
        Confirm password
        <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-800"
        >
          {error}
        </p>
      )}
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
