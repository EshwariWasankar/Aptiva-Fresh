'use client';

import { useState } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** Password input with a show/hide toggle. */
export function PasswordInput({
  value,
  onChange,
  autoComplete = 'current-password',
  required = true,
  className = 'w-full glass-input px-3.5 py-2.5 pr-10 text-sm',
  ariaLabel = 'Password',
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        type={show ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
      >
        {show ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
