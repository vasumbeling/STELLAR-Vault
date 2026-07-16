'use client';

import React, { useState } from 'react';
import { ChevronLeftIcon, LinkIcon } from '@/app/icons';
import FundAccount from '@/components/wallet/FundAccount';
import AddTrustline from '@/components/wallet/AddTrustline';

interface LinkedAccountsSettingsProps {
  onBack?: () => void;
  publicKey: string | null;
  network?: string;
  provider?: string;
  onDisconnect: () => void | Promise<void>;
}

function short(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

const FUTURE_SERVICES = [
  { name: 'Google', description: 'Backup and account recovery' },
  { name: 'Apple', description: 'Sign in and account recovery' },
];

export default function LinkedAccountsSettings({ onBack, publicKey, network, provider, onDisconnect }: LinkedAccountsSettingsProps) {
  const [disconnecting, setDisconnecting] = useState(false);
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

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to settings"
            className="p-1 -ml-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Linked Accounts</h3>
      </div>

      <div className="flex items-center gap-2 bg-orange-50/70 rounded-xl px-4 py-3">
        <LinkIcon className="text-[#FF9F1C] w-4 h-4 shrink-0" />
        <p className="text-xs text-orange-900/70">Connected wallets and services tied to your STELLA account.</p>
      </div>

      {/* Connected wallet */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Wallet</p>

        {publicKey ? (
          <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700">{provider || 'Freighter'}</p>
                <p className="text-xs text-slate-400 mt-0.5">{network || 'Testnet'} · Connected</p>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="w-full text-left px-4 py-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 hover:bg-slate-50 transition-colors"
            >
              {copied ? 'Copied to clipboard' : short(publicKey)}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full px-4 py-3.5 border-t border-slate-100 text-sm font-medium text-rose-500 hover:bg-rose-50 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Wallet'}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-2xl px-4 py-3.5 shadow-xs">
            <p className="text-xs text-slate-400">No wallet connected.</p>
          </div>
        )}
      </div>

      {/* Wallet setup */}
      {publicKey && (
        <div className="space-y-2">
          <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Wallet Setup</p>
          <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">Fund Wallet</p>
                <p className="text-xs text-slate-400 mt-0.5">Pull test network assets</p>
              </div>
              <FundAccount publicKey={publicKey} onFunded={() => {}} />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">USDC Trustline</p>
                <p className="text-xs text-slate-400 mt-0.5">Hold and receive USDC</p>
              </div>
              <AddTrustline publicKey={publicKey} onDone={() => {}} />
            </div>
          </div>
        </div>
      )}

      {/* Connected services */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Connected Services</p>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
          {FUTURE_SERVICES.map((service) => (
            <div key={service.name} className="flex items-center justify-between gap-3 px-4 py-3.5 opacity-50 cursor-not-allowed">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{service.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{service.description}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 rounded-full px-2 py-1 shrink-0">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}