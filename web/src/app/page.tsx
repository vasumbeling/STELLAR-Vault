'use client';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import ConnectWallet from '@/components/ConnectWallet';
import FundAccount from '@/components/FundAccount';
import AddTrustline from '@/components/AddTrustline';
import SavingsDashboard from '@/components/SavingsDashboard';
import { clearAccount } from '@/lib/auth/storage';

/* ---------- Pure Inline Decorative Icons ---------- */
function ShieldIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );
}

function SparkleStar({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2c0 4.2 1.2 7 3.2 9S22 12.8 22 12s-4.8-.8-6.8-2.8S12 2 12 2z" fill="currentColor" />
      <path d="M12 22c0-4.2-1.2-7-3.2-9S2 11.2 2 12s4.8.8 6.8 2.8S12 22 12 22z" fill="currentColor" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const wallet = useWallet();
  const { publicKey, connecting, status, network, provider, signerAvailable, error, disconnect, initialized } = wallet;
  const [refreshKey, setRefreshKey] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

// ── Auth gate ──────────────────────────────────────────────
useEffect(() => {
  // Wait until the wallet hook has finished hydrating/restoring
  if (!wallet.initialized && wallet.status !== 'ready') {
    return;
  }

  // Make sure a local account exists
  const account = localStorage.getItem('stella_vault_account');
  if (!account) {
    router.replace('/register');
    return;
  }

  // If the wallet isn't unlocked, go to login
  if (!wallet.publicKey || !wallet.signerAvailable) {
    router.replace('/login');
    return;
  }

  // Everything is good
  setAuthChecked(true);
}, [
  wallet.initialized,
  wallet.status,
  wallet.publicKey,
  wallet.signerAvailable,
  router,
]);

  const handleLogout = useCallback(async () => {
    await disconnect();                              // clears 'stella-vault.wallet'
    // clearAccount();                                   // clears the PIN-encrypted account
    // localStorage.removeItem('stella_vault_account');  // clears the auth gate flag
    router.replace('/login');
  }, [disconnect, router]);

  // Don't flash the dashboard while checking auth
  if (!authChecked) return null;

  return (
    <main className="min-h-screen w-full bg-[#FAF6F0] text-slate-800 antialiased selection:bg-[#6C5DD3]/10">
      <div className="mx-auto max-w-md px-4 py-12">
        
        {/* Core Header Section */}
        <header className="mb-6 flex items-start justify-between gap-4 px-1">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#6C5DD3] rounded-xl text-white">
                <SparkleStar className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">STELLA Vault</h1>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
              Soroban Engine · Smart Testnet
            </p>
          </div>
          <ConnectWallet {...wallet} />
        </header>

        {/* Cryptographic Session State Card */}
        <section className="mb-5 rounded-4xl border border-violet-100/50 bg-white p-5 shadow-xl shadow-indigo-900/5">
          <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-3">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 tracking-tight">
              <ShieldIcon className="h-4 w-4 text-[#6C5DD3]" />
              Secure Identity Ledger
            </div>
            <span className="rounded-full bg-indigo-50/60 border border-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5B4FBF]">
              {status}
            </span>
          </div>
          
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Public Node Address</span>
              <p className="font-mono font-bold text-slate-700 break-all">
                {publicKey ? `${publicKey.slice(0, 12)}…${publicKey.slice(-8)}` : 'Not connected'}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Horizon</span>
              <p className="font-semibold text-slate-700 capitalize">{network || 'none'}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extension Bridge</span>
              <p className="font-semibold text-slate-700 capitalize">{provider || 'none'}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cryptographic Signer</span>
              <p className={`font-bold ${signerAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
                {signerAvailable ? 'Live & Available' : 'Locked'}
              </p>
            </div>
          </div>
          
          {error && (
            <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
              <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
            </div>
          )}
        </section>

        {/* Empty Wallet State Frame */}
        {!publicKey && !connecting && (
          <div className="mb-5 rounded-4xl border border-violet-100/40 bg-white/80 backdrop-blur-sm py-12 px-6 text-center shadow-inner">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[#6C5DD3]">
              <ShieldIcon className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-slate-600 mb-1">Authorization Credentials Required</p>
            <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-xs mx-auto">
              Connect your Freighter hardware or browser layer extension to configure your profile token variables. 
              If needed,{' '}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#6C5DD3] hover:underline"
              >
                Install Freighter Extension
              </a>{' '}
              and switch the runtime to Test Net mode.
            </p>
          </div>
        )}

        {/* On-Chain Pipeline Interaction Gate */}
        {publicKey && (
          <div className="mb-4 flex flex-wrap items-center gap-2.5 px-1">
            <FundAccount publicKey={publicKey} onFunded={refresh} />
            <AddTrustline publicKey={publicKey} onDone={refresh} />
          </div>
        )}

        {/* Stellar Core Performance Interface */}
        <SavingsDashboard key={refreshKey} publicKey={publicKey} onLogout={handleLogout} />

        {/* Hackathon Meta Attributions */}
        <footer className="mt-12 text-center text-[10px] font-semibold tracking-wide text-slate-400 px-4 leading-relaxed">
          Built by Team Ada&apos;s Lovelies
          <br />
          <span className="opacity-75 font-normal">One secure vault and one community at a time.</span>
        </footer>
      </div>
    </main>
  );
}