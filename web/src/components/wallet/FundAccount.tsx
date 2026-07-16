'use client';

import { useState, useEffect, useCallback } from 'react';
import { fundTestnetAccount } from '@/lib/stellar';
import { fetchBalances } from '@/lib/balances';

function FaucetIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22c4-4 7-7.5 7-11.5A7 7 0 0 0 5 10.5C5 14.5 8 18 12 22z" />
      <circle cx="12" cy="10.5" r="2.5" />
    </svg>
  );
}

function XIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function FundAccount({
  publicKey,
  onFunded,
}: {
  publicKey: string;
  onFunded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justFunded, setJustFunded] = useState(false);
  const [funded, setFunded] = useState(false);

  const checkFunded = useCallback(async () => {
    try {
      const balances = await fetchBalances(publicKey);
      const isFunded = balances ? ('funded' in balances ? balances.funded : true) : false;
      setFunded(!!isFunded);
    } catch {
      // leave last-known state as-is on a failed check
    }
  }, [publicKey]);

  useEffect(() => {
    void checkFunded();
  }, [checkFunded]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const fund = async () => {
    setLoading(true);
    setError('');
    try {
      await fundTestnetAccount(publicKey);
      setFunded(true);
      setJustFunded(true);
      onFunded();
      setTimeout(() => setJustFunded(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Fund account"
      >
        <FaucetIcon className={`w-5 h-5 transition-colors ${funded ? 'text-cyan-500' : 'text-orange-500'}`} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white border border-slate-200/60 shadow-xl shadow-slate-900/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-700">Fund Wallet</span>
              <div className="flex items-center gap-2">
                {funded && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Funded</span>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
                  aria-label="Close"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 space-y-2.5">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Pull test network assets into this wallet using Friendbot.
              </p>

              {error && (
                <p className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                  {error}
                </p>
              )}
              {justFunded && !loading && (
                <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2">
                  Wallet funded successfully.
                </p>
              )}

              <button
                onClick={fund}
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-full bg-[#EAFEFE] border border-[#BCEFEF] px-4 py-2 text-xs font-black text-[#0A4B4E] hover:bg-[#D4FAFA] transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3 w-3 text-[#0A4B4E]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Funding…
                  </span>
                ) : funded ? (
                  'Fund Again'
                ) : (
                  'Fund Wallet'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}