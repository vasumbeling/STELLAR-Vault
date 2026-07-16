'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  contractConfigured,
  readSavingsState,
  buildContributeXDR,
  type SavingsState,
} from '@/lib/contract';
import { submitSignedXDR, pollTransaction } from '@/lib/payment';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

function RefreshCwIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  );
}

export default function SavingsGoal({ publicKey }: { publicKey: string | null }) {
  const configured = contractConfigured();
  const [state, setState] = useState<SavingsState | null>(null);
  const [loading, setLoading] = useState(configured);
  const [amount, setAmount] = useState('50'); 
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Fixed: refresh is purely an on-demand async trigger now
  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      const data = await readSavingsState();
      setState(data);
      setLoading(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to read contract');
      setLoading(false);
    }
  }, [configured]);

  // Handle side-effect data fetching cleanly without synchronous state thrashing
  useEffect(() => {
    let isCurrent = true;

    if (configured) {
      readSavingsState()
        .then((data) => {
          if (isCurrent) {
            setState(data);
            setLoading(false);
          }
        })
        .catch((e: unknown) => {
          if (isCurrent) {
            setError(e instanceof Error ? e.message : 'Failed to read contract');
            setLoading(false);
          }
        });
    }

    return () => {
      isCurrent = false;
      if (configured) {
        setLoading(true); // Prep loading state for next structural mount cycle safely
      }
    };
  }, [configured]);

  const contribute = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const xdr = await buildContributeXDR(publicKey, Number(amount));
      const freighter = await import('@stellar/freighter-api');
      const signed = await freighter.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address: publicKey,
      });
      if (signed.error) {
        throw new Error(
          typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
        );
      }
      const hash = await submitSignedXDR(signed.signedTxXdr);
      await pollTransaction(hash);
      setMsg('Contribution recorded on-chain!');
      setAmount('0');
      
      // Explicitly call our on-demand hook after user interaction finishes
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Contribution failed');
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="mt-6 rounded-4xl border border-dashed border-slate-200 bg-white p-6 shadow-xl shadow-indigo-900/5">
        <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">Savings Vault Module</h2>
        <p className="mt-2 text-xs font-medium text-slate-400 leading-relaxed">
          No Soroban engine has been bound. Deploy the tracking smart contract runtime to begin loading deposits.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono font-bold text-indigo-300">
          .\scripts\deploy.ps1
        </pre>
      </div>
    );
  }

  const pct =
    state && state.target > 0
      ? Math.min(100, Math.round((state.saved / state.target) * 100))
      : 0;

  return (
    <div className="mt-6 rounded-4xl border border-violet-100/40 bg-white p-6 shadow-xl shadow-indigo-900/5">
      <h2 className="mb-4 text-sm font-black text-slate-800 tracking-tight uppercase">
        Soroban Savings Goal
      </h2>

      {loading && (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <RefreshCwIcon className="h-3 w-3 animate-spin text-[#6C5DD3]" />
          Reading contract state context…
        </div>
      )}

      {!loading && state && (
        <div className="space-y-4">
          <div className="flex justify-between text-xs font-bold text-slate-500">
            <span>Saved: <strong className="font-mono text-slate-800">${state.saved}</strong></span>
            <span>Target: <strong className="font-mono text-slate-800">${state.target}</strong></span>
          </div>

          <div className="relative pt-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-linear-to-r from-[#6C5DD3] to-[#5B4FBF] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-xs font-black font-mono text-[#6C5DD3]">{pct}% Completed</p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-50">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-400 uppercase">Slide Amount</span>
              <span className="font-mono font-bold text-[#6C5DD3] bg-indigo-50 px-2 py-0.5 rounded-md text-xs">{amount} USDC</span>
            </div>
            <input
              type="range"
              min="0"
              max="500"
              step="5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#6C5DD3] disabled:opacity-50"
            />
          </div>

          <button
            onClick={contribute}
            disabled={busy || !publicKey || Number(amount) <= 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6C5DD3] py-3 text-xs font-bold text-white shadow-md shadow-indigo-900/10 hover:bg-[#5B4FBF] transition-all disabled:opacity-40 active:scale-[0.98]"
          >
            {busy && <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Broadcasting Payload…' : 'Authorize Contribution'}
          </button>

          {!publicKey && (
            <p className="text-[10px] font-semibold text-center text-slate-400">
              Connect your secure browser layer extension to unlock this contract transaction path.
            </p>
          )}
        </div>
      )}

      {msg && (
        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
          <p className="text-[11px] font-bold text-emerald-700">{msg}</p>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
          <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
        </div>
      )}
    </div>
  );
}