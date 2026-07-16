'use client';

import React, { useState } from 'react';
import { ChevronLeftIcon, SecurityIcon } from '@/app/icons';
import Toggle from './Toggle';

const AUTO_LOCK_OPTIONS: { value: string; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: '1m', label: 'After 1 minute' },
  { value: '5m', label: 'After 5 minutes' },
  { value: '15m', label: 'After 15 minutes' },
];

interface SecuritySettingsProps {
  onBack?: () => void;
}

export default function SecuritySettings({ onBack }: SecuritySettingsProps) {
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [autoLock, setAutoLock] = useState('1m');
  const [showChangePin, setShowChangePin] = useState(false);

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
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Security</h3>
      </div>

      <div className="flex items-center gap-2 bg-orange-50/70 rounded-xl px-4 py-3">
        <SecurityIcon className="text-[#FF9F1C] w-4 h-4 shrink-0" />
        <p className="text-xs text-orange-900/70">Your wallet signer is stored encrypted on this device only.</p>
      </div>

      {/* PIN & access */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">PIN &amp; Access</p>

        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
          <button
            onClick={() => setShowChangePin(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-sm font-medium text-slate-700">Change PIN</span>
            <span className="text-xs text-slate-400">••••••</span>
          </button>

          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700">Biometric Unlock</p>
              <p className="text-xs text-slate-400 mt-0.5">Use Face ID / fingerprint to unlock</p>
            </div>
            <Toggle checked={biometricEnabled} onChange={setBiometricEnabled} />
          </div>

          <div className="px-4 py-3.5 space-y-2">
            <p className="text-sm font-medium text-slate-700">Auto-Lock</p>
            <div className="grid grid-cols-2 gap-2">
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAutoLock(opt.value)}
                  className={`py-2 rounded-xl text-[11px] font-medium transition-all ${
                    autoLock === opt.value
                      ? 'bg-orange-50 text-[#FF5E00] border border-orange-100'
                      : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">This Session</p>
        <div className="bg-white border border-slate-200/60 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">Active on this device</p>
            <p className="text-xs text-slate-400 mt-0.5">Testnet · signed in now</p>
          </div>
        </div>
      </div>

      {/* Change PIN modal (placeholder flow) */}
      {showChangePin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowChangePin(false);
          }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">Change PIN</h3>
            <p className="text-xs font-normal text-slate-500 leading-relaxed">
              PIN changes are coming soon. For now, your PIN was set when you created your wallet signer.
            </p>
            <button
              onClick={() => setShowChangePin(false)}
              className="w-full py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] uppercase tracking-wide text-slate-500"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
