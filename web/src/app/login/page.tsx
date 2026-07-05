'use client';

import { useRouter } from 'next/navigation';
import { PinEntry } from '@/components/auth/PinEntry';

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
    <main className="min-h-screen w-full bg-[#FAF8F5] text-slate-800 antialiased selection:bg-[#FF5E00]/10 flex items-center justify-center py-8 px-4">

      {/* Phone frame container — matches live dashboard DOM */}
      <div className="w-full max-w-md min-h-[880px] bg-[#FAF8F5] rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col justify-between font-sans border border-slate-100/80">

        <div className="flex-1 overflow-y-auto px-4 py-12 flex flex-col">

          {/* Core Header Section */}
          <header className="mb-6 px-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#B8FCFC]/40 border border-dashed border-[#B8FCFC] flex items-center justify-center overflow-hidden shrink-0">
                
                <img src="stellamascot.png" alt="STELLA Vault" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">STELLA Vault</h1>
            </div>
          </header>

          {/* PIN unlock card */}
          <div className="flex-1 flex items-center">
            <section className="w-full rounded-4xl border border-[#B8FCFC]/60 bg-white p-6 shadow-xl shadow-slate-900/5">
              <PinEntry onSuccess={handleUnlocked} onForgotPin={handleForgotPin} />
            </section>
          </div>

          <p className="text-center text-xs font-medium text-slate-400 mt-6">
            Don&apos;t have a vault yet?{' '}
            <button
              onClick={() => router.push('/register')}
              className="font-black text-[#FF5E00] hover:underline"
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