import Link from 'next/link';
import { RegisterForm } from '../../components/RegisterForm';

export const metadata = { title: 'Create account — Aptiva' };

export default function RegisterPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center">
      <main className="w-full max-w-md">
        <div className="glass-sheet p-8 sm:p-10 flex flex-col gap-6 shadow-2xl">
          <div className="flex flex-col items-center text-center gap-2">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-base shadow-sm mb-1"
            >
              A
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Create account</h1>
            <p className="text-xs text-stone-500">
              Start your placement aptitude preparation today.
            </p>
          </div>
          <RegisterForm />
        </div>
      </main>
    </div>
  );
}
