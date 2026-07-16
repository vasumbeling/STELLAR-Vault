'use client';

import { useState, useEffect, useCallback } from 'react';
import { buildAddUsdcTrustlineXDR } from '@/lib/trustline';
import { signAndSubmit } from '@/lib/sign';
import { walletService } from '@/lib/wallet';
import { fetchBalances } from '@/lib/balances';
import ActionModal from '@/components/shared/ActionModal';

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

  const iconColor =
    status === 'working' ? 'text-slate-400' : linked ? 'text-cyan-500' : 'text-orange-500';

  const badgeClass =
    status === 'working'
      ? 'bg-slate-100 text-slate-400'
      : linked
      ? 'bg-cyan-50 text-cyan-600'
      : 'bg-orange-50 text-orange-500';

  const statusLabel = status === 'working' ? 'Linking' : linked ? 'Linked' : 'Not Linked';
  const statusClass =
    status === 'working'
      ? 'bg-slate-100 text-slate-500'
      : linked
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-orange-50 text-orange-600';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={status === 'working'}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Add trustline"
      >
        <LinkIcon className={`w-5 h-5 transition-colors ${iconColor}`} />
      </button>

      <ActionModal
        open={open}
        onClose={() => setOpen(false)}
        icon={<LinkIcon className="w-5 h-5" />}
        iconClassName={badgeClass}
        title="USDC Trustline"
        statusLabel={statusLabel}
        statusClassName={statusClass}
      >
        {!needsPin ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              Link a USDC trustline to this wallet so it can hold and receive USDC.
            </p>

            {error && status === 'error' && (
              <p className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2 text-center">
                {error}
              </p>
            )}

            <button
              onClick={runAdd}
              disabled={status === 'working' || linked}
              className={`w-full inline-flex items-center justify-center rounded-full px-4 py-2.5 text-xs font-black transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer ${
                linked
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white shadow-sm shadow-orange-500/20 hover:opacity-95'
              }`}
            >
              {status === 'working' && (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
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
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-700 text-center">
              Session timed out. Enter your PIN to continue.
            </p>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              disabled={unlocking}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700 text-center tracking-widest outline-none focus:border-[#A0F0F0] disabled:opacity-50"
            />
            {pinError && <p className="text-[10px] font-bold text-rose-600 text-center">{pinError}</p>}
            <div className="flex gap-1.5">
              <button
                onClick={handleUnlockAndRetry}
                disabled={unlocking || !pinInput}
                className="flex-1 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] py-2.5 text-[11px] font-bold text-white shadow-sm shadow-orange-500/20 disabled:opacity-40"
              >
                {unlocking ? 'Unlocking…' : 'Unlock & Continue'}
              </button>
              <button
                onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
                disabled={unlocking}
                className="rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] font-bold text-slate-600 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </ActionModal>
    </>
  );
}