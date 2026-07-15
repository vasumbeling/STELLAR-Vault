'use client';

import { useState, useEffect, useRef } from 'react';
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

function short(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default function ConnectWallet(wallet: WalletState) {
  const { publicKey, connecting, connect, disconnect } = wallet;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={connecting}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
        aria-label="Wallet"
      >
        <WalletIcon className="w-5 h-5 text-slate-500" />
        {publicKey && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
        )}
        {connecting && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200/60 shadow-lg shadow-slate-900/10 z-50 animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Wallet</span>
            {publicKey && (
              <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Connected</span>
            )}
          </div>

          {publicKey ? (
            <div className="px-4 py-3 space-y-3">
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
      )}
    </div>
  );
}