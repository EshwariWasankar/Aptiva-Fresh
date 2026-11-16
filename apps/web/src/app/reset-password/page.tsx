import Link from 'next/link';
import { ResetPasswordPanel } from '../../components/ResetPasswordPanel';

export const metadata = { title: 'Reset password — Aptiva' };

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center">
      <main className="w-full max-w-md">
        <div className="glass-sheet p-8 sm:p-10 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col items-center text-center gap-2">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-slate-900 text-white font-bold text-base shadow-md shadow-indigo-950/40 border border-indigo-400/30 mb-1"
            >
              A
            </Link>
          </div>
          <ResetPasswordPanel />
        </div>
      </main>
    </div>
  );
}
