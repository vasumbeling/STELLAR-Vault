'use client';

import { useRouter } from 'next/navigation';
import { PinEntry } from '@/components/auth/PinEntry';

/* ---------- Pure Inline Decorative Icon (matches dashboard) ---------- */
function SparkleStar({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2c0 4.2 1.2 7 3.2 9S22 12.8 22 12s-4.8-.8-6.8-2.8S12 2 12 2z" fill="currentColor" />
      <path d="M12 22c0-4.2-1.2-7-3.2-9S2 11.2 2 12s4.8.8 6.8 2.8S12 22 12 22z" fill="currentColor" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  function handleUnlocked() {
    router.push('/');
  }

  function handleForgotPin() {
    // TODO: point this at your recovery-phrase flow once that route exists
    router.push('/recover');
  }

  return (
    <main className="min-h-screen w-full bg-[#FAF6F0] text-slate-800 antialiased selection:bg-[#6C5DD3]/10 flex items-center justify-center py-8 px-4">

      {/* Phone frame container — matches live dashboard DOM */}
      <div className="w-full max-w-md min-h-[880px] bg-[#F9F8FE] rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col justify-between font-sans border border-slate-100/80">

        <div className="flex-1 overflow-y-auto px-4 py-12 flex flex-col">

          {/* Core Header Section */}
          <header className="mb-6 px-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="p-1.5 bg-[#6C5DD3] rounded-xl text-white">
                <SparkleStar className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">STELLA Vault</h1>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
              Soroban Engine · Smart Testnet
            </p>
          </header>

          {/* PIN unlock card */}
          <div className="flex-1 flex items-center">
            <section className="w-full rounded-4xl border border-violet-100/50 bg-white p-6 shadow-xl shadow-indigo-900/5">
              <PinEntry onSuccess={handleUnlocked} onForgotPin={handleForgotPin} />
            </section>
          </div>

          <p className="text-center text-xs font-medium text-slate-400 mt-6">
            Don&apos;t have a vault yet?{' '}
            <button
              onClick={() => router.push('/register')}
              className="font-black text-[#6C5DD3] hover:underline"
            >
              Create one
            </button>
          </p>

          {/* Footer */}
          <footer className="mt-10 text-center text-[10px] font-semibold tracking-wide text-slate-400 px-4 leading-relaxed">
            Built by Team Ada&apos;s Lovelies
            <br />
            <span className="opacity-75 font-normal">One secure vault and one community at a time.</span>
          </footer>

        </div>
      </div>
    </main>
  );
}