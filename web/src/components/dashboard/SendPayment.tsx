'use client';
import { useState } from 'react';
import {
  buildPaymentXDR,
  submitSignedXDR,
  pollTransaction,
  type AssetCode,
} from '@/lib/payment';
import { NETWORK_PASSPHRASE } from '@/lib/stellar';

type Status =
  | 'idle'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'error';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Authorize Secure Payment',
  building: 'Constructing Transaction Payload…',
  signing: 'Opening Wallet Signing Port…',
  submitting: 'Pushing to Core Consensus Network…',
  polling: 'Validating Final Ledger Confirmation…',
  success: 'Authorize Secure Payment',
  error: 'Authorize Secure Payment',
};

function RefreshCwIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  );
}

export default function SendPayment({
  publicKey,
  onSent,
}: {
  publicKey: string;
  onSent: () => void;
}) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('10'); // Managed via slider track bounds
  const [asset, setAsset] = useState<AssetCode>('XLM');
  const [status, setStatus] = useState<Status>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const busy = ['building', 'signing', 'submitting', 'polling'].includes(status);

  const handleSend = async () => {
    setStatus('building');
    setErrorMsg('');
    setTxHash('');
    try {
      const xdr = await buildPaymentXDR(publicKey, destination.trim(), amount, asset);

      setStatus('signing');
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

      setStatus('submitting');
      const hash = await submitSignedXDR(signed.signedTxXdr);
      setTxHash(hash);

      setStatus('polling');
      await pollTransaction(hash);
      setStatus('success');
      onSent();
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Payment failed');
      setStatus('error');
    }
  };

  return (
    <div className="mt-6 rounded-4xl border border-violet-100/40 bg-white p-6 shadow-xl shadow-indigo-900/5">
      <h2 className="mb-5 text-sm font-black text-slate-800 tracking-tight uppercase">Send Global Payment</h2>

      <div className="space-y-4">
        {/* Asset Selection */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Settlement Currency</label>
          <div className="relative">
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value as AssetCode)}
              className="w-full appearance-none rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-200 transition-colors"
            >
              <option value="XLM">Native Lumen Asset (XLM)</option>
              <option value="USDC">Stellar Fiat Peg (USDC - Requires Trustline)</option>
            </select>
            <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        {/* Destination Address */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Destination Public Key</label>
          <input
            type="text"
            placeholder="G… (Funded target address)"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 font-mono text-xs text-slate-700 outline-none focus:border-violet-200 transition-colors placeholder:text-slate-300"
          />
        </div>

        {/* Clamped Slider Amount */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
            <span className="text-slate-400">Amount To Send</span>
            <span className="font-mono text-[#6C5DD3] bg-indigo-50 px-2 py-0.5 rounded-md text-xs normal-case">{amount} {asset}</span>
          </div>
          <input
            type="range"
            min="0"
            max={asset === 'XLM' ? '100' : '50'}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
            className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#6C5DD3] disabled:opacity-50"
          />
        </div>

        {/* Action Submit */}
        <button
          onClick={handleSend}
          disabled={busy || !destination || Number(amount) <= 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#6C5DD3] py-3 text-xs font-bold text-white shadow-md shadow-indigo-900/10 hover:bg-[#5B4FBF] transition-all disabled:opacity-40 active:scale-[0.98] mt-2"
        >
          {busy && <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />}
          {STATUS_LABEL[status]}
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 space-y-1.5">
          <p className="text-xs font-bold text-emerald-800">Payment successfully verified.</p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6C5DD3] hover:underline"
          >
            Inspect Ledger Receipt ↗
          </a>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
          <p className="text-[11px] font-bold text-rose-600 leading-normal">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}