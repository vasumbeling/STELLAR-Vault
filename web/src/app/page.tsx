'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '@/hooks/useWallet';
import { hasAccount } from '@/lib/auth/storage';
import { fetchBalances } from '@/lib/balances';
import ConnectWallet from '@/components/wallet/ConnectWallet';
import FundAccount from '@/components/wallet/FundAccount';
import AddTrustline from '@/components/wallet/AddTrustline';
import SavingsDashboard from '@/components/dashboard/SavingsDashboard';

export default function Home() {
  const router = useRouter();
  const wallet = useWallet();
  const { publicKey, connecting, disconnect } = wallet;
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [funded, setFunded] = useState(false);
  const [linked, setLinked] = useState(false);

  const refresh = useCallback(() => setLocalRefreshKey((k) => k + 1), []);

  // Track wallet setup completion so the Fund/Trustline header icons can
  // disappear once they're no longer needed — they're one-time onboarding
  // steps, not ongoing controls like Connect or Notifications.
  useEffect(() => {
    let ignore = false;
    if (!publicKey) { setFunded(false); setLinked(false); return; }
    fetchBalances(publicKey)
      .then((balances) => {
        if (ignore) return;
        setFunded(balances ? ('funded' in balances ? !!balances.funded : true) : false);
        setLinked(!!balances && 'usdc' in balances);
      })
      .catch(() => {
        if (ignore) return;
        setFunded(false);
        setLinked(false);
      });
    return () => { ignore = true; };
  }, [publicKey, localRefreshKey]);

  // ── Auth gate ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasAccount()) {
      router.replace('/register');
      return;
    }

    if (wallet.initialized || wallet.status === 'ready') {
      if (!wallet.publicKey || !wallet.signerAvailable) {
        router.replace('/login');
      } else {
        setAuthChecked(true);
      }
      return;
    }

    const timeout = setTimeout(() => {
      if (!wallet.publicKey || !wallet.signerAvailable) {
        router.replace('/login');
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [
    wallet.initialized,
    wallet.status,
    wallet.publicKey,
    wallet.signerAvailable,
    router,
  ]);

  const handleLogout = useCallback(async () => {
    await disconnect(); // clears 'stella-vault.wallet'
    router.replace('/login');
  }, [disconnect, router]);

  if (!authChecked) {
    return (
      <main className="min-h-screen w-full bg-[#FAF6F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6C5DD3] border-t-transparent" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Checking session…
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] text-slate-800 antialiased selection:bg-[#FF5E00]/10 pb-16">
      <div className="mx-auto max-w-md px-4 py-8">

        {/* Empty Wallet State Frame */}
        {!publicKey && !connecting && (
          <div className="mb-5 rounded-[2.2rem] border border-orange-100/30 bg-white/60 backdrop-blur-md py-10 px-6 text-center shadow-xs">
            {/* Mascot Container */}
            <div className="mx-auto mb-4 w-24 h-24 relative">
              <Image
                src="/stellamascot.png"
                alt="Stella Mascot"
                fill
                priority
                sizes="96px"
                className="object-contain"
              />
            </div>
            <p className="text-xs font-black text-slate-800 mb-1.5 uppercase tracking-wide">
              Authorization Credentials Required
            </p>
            <p className="text-[11px] font-semibold text-slate-400 leading-relaxed max-w-xs mx-auto">
              Connect your Freighter hardware or browser layer extension to configure your profile token variables.
              If needed,{' '}
              
                <a href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-black text-[#FF5E00] hover:underline"
              >
                Install Freighter Extension
              </a>{' '}
              and switch the runtime to Test Net mode.
            </p>
          </div>
        )}

        {/* Stellar Core Performance Interface */}
        <div className="mt-2">
          <SavingsDashboard
            key={localRefreshKey}
            wallet={wallet}
            publicKey={publicKey}
            onLogout={handleLogout}
            headerActions={
              <>
                {publicKey && !funded && (
                  <FundAccount publicKey={publicKey} onFunded={refresh} />
                )}
                {publicKey && !linked && (
                  <AddTrustline publicKey={publicKey} onDone={refresh} />
                )}
              </>
            }
            connectWalletAction={<ConnectWallet {...wallet} />}
          />
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