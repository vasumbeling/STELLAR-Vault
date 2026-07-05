'use client';

import { useState } from 'react';
import { buildAddUsdcTrustlineXDR } from '@/lib/trustline';
import { signAndSubmit } from '@/lib/sign';
import { walletService } from '@/lib/wallet';

type Status = 'idle' | 'working' | 'done' | 'error';

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function AddTrustline({
  publicKey,
  onDone,
}: {
  publicKey: string;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const runAdd = async () => {
    setStatus('working');
    setError('');
    try {
      const xdr = await buildAddUsdcTrustlineXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      setStatus('done');
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
    <div className="inline-block text-left relative">
      {!needsPin && (
        <button
          onClick={runAdd}
          disabled={status === 'working' || status === 'done'}
          className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-black transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer ${
            status === 'done'
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
          {status === 'idle' && 'Add Trustline'}
          {status === 'error' && 'Retry Trustline'}
          {status === 'done' && 'Linked'}
        </button>
      )}

      {needsPin && (
        <div className="absolute z-50 mt-1 w-64 rounded-xl border border-indigo-100 bg-white p-3 shadow-lg space-y-2">
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
              className="flex-1 rounded-lg bg-[#6C5DD3] py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              {unlocking ? 'Unlocking…' : 'Unlock & Continue'}
            </button>
            <button
              onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
              disabled={unlocking}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && status === 'error' && (
        <p className="text-[10px] font-bold text-rose-500 mt-1.5 px-1 absolute bg-[#FAF8F5] rounded border border-rose-100 p-1 shadow-sm z-50">
          {error}
        </p>
      )}
    </div>
  );
}