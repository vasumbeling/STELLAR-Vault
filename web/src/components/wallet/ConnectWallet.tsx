'use client';

import { useState } from 'react';
import type { WalletState } from '@/hooks/useWallet';
import ActionModal from '@/components/shared/ActionModal';

function WalletIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  );
}

function CopyIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function short(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default function ConnectWallet(wallet: WalletState) {
  const { publicKey, connecting, connect, disconnect } = wallet;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleConnect = async () => {
    await connect();
  };

  const iconColor = connecting
    ? 'text-slate-400'
    : publicKey
    ? 'text-cyan-500'
    : 'text-orange-500';

  const badgeClass = connecting
    ? 'bg-slate-100 text-slate-400'
    : publicKey
    ? 'bg-cyan-50 text-cyan-600'
    : 'bg-orange-50 text-orange-500';

  const statusLabel = connecting ? 'Connecting' : publicKey ? 'Connected' : 'Not Connected';
  const statusClass = connecting
    ? 'bg-slate-100 text-slate-500'
    : publicKey
    ? 'bg-emerald-50 text-emerald-600'
    : 'bg-orange-50 text-orange-600';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={connecting}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Wallet"
      >
        <WalletIcon className={`w-5 h-5 transition-colors ${iconColor}`} />
      </button>

      <ActionModal
        open={open}
        onClose={() => setOpen(false)}
        icon={<WalletIcon className="w-5 h-5" />}
        iconClassName={badgeClass}
        title="Wallet"
        statusLabel={statusLabel}
        statusClassName={statusClass}
      >
        {publicKey ? (
          <div className="space-y-3">
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 text-left hover:bg-slate-100 transition-colors"
            >
              <span className="text-[11px] font-mono text-slate-500 truncate">
                {copied ? 'Copied to clipboard' : short(publicKey)}
              </span>
              <CopyIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
            <button
              onClick={() => { void disconnect(); setOpen(false); }}
              className="w-full rounded-xl bg-rose-50 hover:bg-rose-100 text-[#FF4E00] text-[11px] font-bold uppercase tracking-wider transition-colors py-3 cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              Connect your wallet to fund your account and start saving.
            </p>
            <button
              onClick={() => void handleConnect()}
              disabled={connecting}
              className="w-full inline-flex items-center justify-center rounded-full bg-linear-to-r from-[#FF9F1C] to-[#F37A00] px-4 py-2.5 text-xs font-black text-white shadow-sm shadow-orange-500/20 hover:opacity-95 transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </ActionModal>
    </>
  );
}