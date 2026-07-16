'use client';

import { useState, useEffect, useCallback } from 'react';
import { buildAddUsdcTrustlineXDR } from '@/lib/trustline';
import { signAndSubmit } from '@/lib/sign';
import { walletService } from '@/lib/wallet';
import { fetchBalances } from '@/lib/balances';

type Status = 'idle' | 'working' | 'error';

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

function LinkIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
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

export default function AddTrustline({
  publicKey,
  onDone,
}: {
  publicKey: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);

  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const checkLinked = useCallback(async () => {
    try {
      const balances = await fetchBalances(publicKey);
      setLinked(!!balances && 'usdc' in balances);
    } catch {
      // leave last-known state as-is on a failed check
    }
  }, [publicKey]);

  useEffect(() => {
    void checkLinked();
  }, [checkLinked]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const runAdd = async () => {
    setStatus('working');
    setError('');
    try {
      const xdr = await buildAddUsdcTrustlineXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      setStatus('idle');
      setLinked(true);
      onDone();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed';

      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setNeedsPin(true);
        setStatus('idle');
        return;
      }

      setError(message);
      setStatus('error');
    }
  };

  const handleUnlockAndRetry = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      await walletService.unlockPinAccount(pinInput);
      setNeedsPin(false);
      setPinInput('');
      await runAdd();
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={status === 'working'}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Add trustline"
      >
        <LinkIcon
          className={`w-5 h-5 transition-colors ${
            status === 'working'
              ? 'text-slate-400'
              : linked
              ? 'text-cyan-500'
              : 'text-orange-500'
          }`}
        />
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
              <span className="text-xs font-semibold text-slate-700">USDC Trustline</span>
              <div className="flex items-center gap-2">
                {linked && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Linked</span>
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

            {!needsPin ? (
              <div className="px-4 py-4 space-y-2.5">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Link a USDC trustline to this wallet so it can hold and receive USDC.
                </p>

                {error && status === 'error' && (
                  <p className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                    {error}
                  </p>
                )}

                <button
                  onClick={runAdd}
                  disabled={status === 'working' || linked}
                  className={`w-full inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-black transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer ${
                    linked
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-[#EAFEFE] border border-[#BCEFEF] text-[#0A4B4E] hover:bg-[#D4FAFA]'
                  }`}
                >
                  {status === 'working' && (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3 text-[#0A4B4E]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Linking…
                    </span>
                  )}
                  {status !== 'working' && status === 'error' && 'Retry Trustline'}
                  {status !== 'working' && status !== 'error' && linked && 'Linked'}
                  {status !== 'working' && status !== 'error' && !linked && 'Add Trustline'}
                </button>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-700">
                  Session timed out. Enter your PIN to continue.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter PIN"
                  disabled={unlocking}
                  className="w-full rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-violet-300 disabled:opacity-50"
                />
                {pinError && <p className="text-[10px] font-bold text-rose-600">{pinError}</p>}
                <div className="flex gap-1.5">
                  <button
                    onClick={handleUnlockAndRetry}
                    disabled={unlocking || !pinInput}
                    className="flex-1 rounded-lg bg-[#6C5DD3] py-2 text-[11px] font-bold text-white disabled:opacity-40"
                  >
                    {unlocking ? 'Unlocking…' : 'Unlock & Continue'}
                  </button>
                  <button
                    onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
                    disabled={unlocking}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}