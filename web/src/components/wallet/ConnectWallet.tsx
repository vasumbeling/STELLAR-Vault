'use client';

import { useState, useEffect } from 'react';
import type { WalletState } from '@/hooks/useWallet';

function WalletIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
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

function short(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default function ConnectWallet(wallet: WalletState) {
  const { publicKey, connecting, connect, disconnect } = wallet;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

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
              <span className="text-xs font-semibold text-slate-700">Wallet</span>
              <div className="flex items-center gap-2">
                {publicKey && (
                  <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Connected</span>
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

            {publicKey ? (
              <div className="px-4 py-4 space-y-3">
                <button
                  onClick={handleCopy}
                  className="w-full text-left rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-[11px] font-mono text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  {copied ? 'Copied to clipboard' : short(publicKey)}
                </button>
                <button
                  onClick={() => { void disconnect(); setOpen(false); }}
                  className="w-full rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-[#FF4E00] text-[11px] font-bold text-slate-500 transition-colors py-2.5 cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="px-4 py-4">
                <button
                  onClick={() => void handleConnect()}
                  disabled={connecting}
                  className="w-full inline-flex items-center justify-center rounded-full bg-[#EAFEFE] border border-[#BCEFEF] px-4 py-2 text-xs font-black text-[#0A4B4E] hover:bg-[#D4FAFA] transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}