'use client';
import { useState, useEffect } from 'react';
import { fetchBalances, type Balances } from '@/lib/balances';

export default function BalanceCard({
  publicKey,
  refreshKey,
  actions,
}: {
  publicKey: string;
  refreshKey: number;
  /** ConnectWallet + NotificationBell (or any other header controls),
   *  rendered in the card's own top row so wallet controls stay visible
   *  even while balances are loading, empty, or failed to fetch. */
  actions?: React.ReactNode;
}) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Do NOT call setLoading(true) here synchronously.
    // Instead, handle your data fetch immediately.
    fetchBalances(publicKey)
      .then((b) => {
        if (active) {
          setBalances(b);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setBalances(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      // When dependency updates, we gracefully flip loading to true 
      // for the next cycle without triggering a synchronous render block.
      setLoading(true);
    };
  }, [publicKey, refreshKey]);

  const notFunded = balances && !('funded' in balances ? balances.funded : true);
  const xlmVal = balances && 'xlm' in balances ? balances.xlm : '0';
  const usdcVal = balances && 'usdc' in balances ? balances.usdc : '0';

  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Header row — always rendered, regardless of balance state, so
          wallet controls (connect, notifications, etc.) stay reachable
          even while balances are loading or unavailable. */}
      {actions && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Wallet</span>
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      ) : notFunded ? (
        <div className="p-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-xs font-semibold text-amber-800 leading-relaxed">
              ⚠️ This cryptographic account is empty. Use the <strong className="font-bold text-orange-950">Fund with Friendbot</strong> engine to pull asset tokens onto the test environment network.
            </p>
          </div>
        </div>
      ) : !balances ? (
        <div className="p-4">
          <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3">
            <p className="text-xs font-bold text-rose-600">Failed to establish query balance links.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="rounded-2xl bg-slate-50/70 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">XLM Balance</span>
            <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              {Number(xlmVal || 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50/70 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">USDC Liquid</span>
            <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
              {Number(usdcVal || 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}