'use client';
import { useMemo, useState } from 'react';
import type { WalletState } from '@/hooks/useWallet';

export default function ConnectWallet(wallet: WalletState) {
  const [copied, setCopied] = useState(false);
  const { publicKey, connecting, error, connect, disconnect, ready, status } = wallet;

  const copy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const buttonLabel = useMemo(() => {
    if (connecting) return 'Connecting...';
    if (ready) return 'Wallet Connected';
    if (error) return 'Retry Connection';
    return 'Connect Wallet';
  }, [connecting, ready, error]);

  if (publicKey) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button
          onClick={copy}
          title="Copy full address"
          className="rounded bg-gray-100 px-3 py-1 font-mono text-sm text-gray-700 transition-colors hover:bg-gray-200"
        >
          {copied ? 'Copied!' : `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}`}
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            {status}
          </span>
          <button onClick={() => void disconnect()} className="text-sm text-red-500 hover:underline">
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        onClick={() => void connect()}
        disabled={connecting}
        className="rounded bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {buttonLabel}
      </button>
      {error && <p className="mt-2 max-w-xs text-sm text-red-500">{error}</p>}
    </div>
  );
}
