import Link from 'next/link';
import { VerifyEmailPanel } from '../../components/VerifyEmailPanel';

export const metadata = { title: 'Verify email — Aptiva' };

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center">
      <main className="w-full max-w-md">
        <div className="glass-sheet p-8 sm:p-10 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col items-center text-center gap-2">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-base shadow-md shadow-purple-500/20 mb-1"
            >
              A
            </Link>
          </div>
          <VerifyEmailPanel />
        </div>
      </main>
    </div>
  );
}
