'use client';

import { useState } from 'react';
import { fundTestnetAccount } from '@/lib/stellar';

export default function FundAccount({
  publicKey,
  onFunded,
}: {
  publicKey: string;
  onFunded: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fund = async () => {
    setLoading(true);
    setError('');
    try {
      await fundTestnetAccount(publicKey);
      onFunded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-block text-left">
      <button
        onClick={fund}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-full bg-[#EAFEFE] border border-[#BCEFEF] px-4 py-1.5 text-xs font-black text-[#0A4B4E] hover:bg-[#D4FAFA] transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <svg className="animate-spin h-3 w-3 text-[#0A4B4E]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Funding…
          </span>
        ) : (
          'Fund Wallet'
        )}
      </button>

      {error && (
        <p className="text-[10px] font-bold text-rose-500 mt-1.5 px-1 absolute bg-[#FAF8F5] rounded border border-rose-100 p-1 shadow-sm z-50">
          {error}
        </p>
      )}
    </div>
  );
}