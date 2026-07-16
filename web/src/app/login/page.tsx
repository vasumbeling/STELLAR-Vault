'use client';

import { useRouter } from 'next/navigation';
import { PinEntry } from '@/components/auth/PinEntry';

export default function LoginPage() {
  const router = useRouter();

  function handleUnlocked() {
    router.push('/');
  }

  function handleForgotPin() {
    router.push('/recover');
  }

  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] text-slate-700 antialiased flex items-center justify-center py-6 px-4">
      {/* Structural Phone Container Frame */}
      <div className="w-full max-w-sm min-h-205 bg-[#FAF8F5] flex flex-col justify-between font-sans px-2 py-4">

        <div className="flex-1 flex flex-col justify-center">

          {/* Core Header Section / Mascot Branding */}
          <header className="mb-8 px-1 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              {/* Refined Brand Crest Frame */}
              <div className="w-16 h-16 rounded-2xl bg-linear-to-b from-[#B8FCFC]/40 to-amber-50/30 border border-dashed border-[#B8FCFC] flex items-center justify-center overflow-hidden shrink-0 shadow-sm shadow-cyan-100/50">
                <img src="/stellamascot.png" alt="STELLA Vault" className="w-12 h-12 object-contain" />
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold text-[#FF5E00] tracking-tight">STELLA Vault</h1>
              </div>
            </div>
          </header>

          {/* Secure Interactive Numpad Area */}
          <div className="w-full max-w-xs mx-auto">
            <PinEntry onSuccess={handleUnlocked} onForgotPin={handleForgotPin} />
          </div>

          {/* Registration Redirect Node Links */}
          <p className="text-center text-xs font-normal text-slate-400 mt-8">
            Don&apos;t have a vault yet?{' '}
            <button
              onClick={() => router.push('/register')}
              className="font-medium text-[#FF5E00] hover:underline"
            >
              Create one
            </button>
          </p>

        </div>

        {/* Brand System Footer Deck Layout */}
        <div className="flex flex-col items-center space-y-4 pt-12">
          <span className="text-[10px] font-normal text-slate-400 tracking-normal">
            © 2026 Team Ada's Lovelies. All rights reserved.
          </span>
        </div>

      </div>
    </main>
  );
}