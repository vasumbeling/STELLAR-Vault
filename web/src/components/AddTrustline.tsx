'use client';

import { useState } from 'react';
import { buildAddUsdcTrustlineXDR } from '@/lib/trustline';
import { signAndSubmit } from '@/lib/sign';

type Status = 'idle' | 'working' | 'done' | 'error';

export default function AddTrustline({
  publicKey,
  onDone,
}: {
  publicKey: string;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const add = async () => {
    setStatus('working');
    setError('');
    try {
      const xdr = await buildAddUsdcTrustlineXDR(publicKey);
      await signAndSubmit(xdr, publicKey);
      setStatus('done');
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
      setStatus('error');
    }
  };

  return (
    <div className="inline-block text-left">
      <button
        onClick={add}
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

      {error && status === 'error' && (
        <p className="text-[10px] font-bold text-rose-500 mt-1.5 px-1 absolute bg-[#FAF8F5] rounded border border-rose-100 p-1 shadow-sm z-50">
          {error}
        </p>
      )}
    </div>
  );
}