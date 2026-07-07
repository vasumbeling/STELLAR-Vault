'use client';

import React from 'react';
import Image from 'next/image';

interface ProfileProps {
  publicKey: string | null;
  phpRate: number;
  purchasingPowerSaved: number;
  copied: boolean;
  onCopyAddress: () => void;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  wallet: {
    status?: string;
    network?: string;
    provider?: string;
    signerAvailable?: boolean;
    error?: string | null;
  };
  username?: string;
  handle?: string;
  vaultsCount?: number;
  points?: number;
  avatarSrc?: string;
  phoneVerified?: boolean;
  identityVerified?: boolean;
  communityTrustUnlocked?: boolean;
  onVerifyIdentity?: () => void;
  onOpenSettings?: () => void;
  onOpenSecurity?: () => void;
  onOpenSupport?: () => void;
}

function CheckBadgeIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <path d="M9 12l2 2 4-4"></path>
    </svg>
  );
}

function LockIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2"></rect>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
    </svg>
  );
}

function EditIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  );
}

function SettingsIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  );
}

function SecurityIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );
}

function SupportIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function LogoutIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );
}

export default function Profile({
  wallet,
  onLogout,
  username = 'Starry Voyager',
  handle = 'stella_user_882',
  vaultsCount = 12,
  points = 2450,
  avatarSrc = '/stellamascot.png',
  phoneVerified = true,
  identityVerified = false,
  communityTrustUnlocked = false,
  onVerifyIdentity,
  onOpenSettings,
  onOpenSecurity,
  onOpenSupport,
}: ProfileProps) {
  const { network } = wallet || {};

  return (
    <div className="px-5 py-4 space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">STELLA Vault</h3>
        <span className="px-3 py-1 text-[11px] font-medium bg-[#9AFAFA] text-[#0F4F53] rounded-full uppercase tracking-wider">
          {network || 'Testnet'}
        </span>
      </div>

      {/* Avatar + identity */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="relative w-20 h-20">
          <div className="w-20 h-20 rounded-full bg-linear-to-b from-orange-50 to-orange-100 border-4 border-white shadow-md shadow-orange-900/10 overflow-hidden relative">
            <Image
              src={avatarSrc}
              alt="Profile avatar"
              fill
              priority
              sizes="80px"
              className="object-contain p-2"
            />
          </div>
          <button
            type="button"
            aria-label="Edit avatar"
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#FF5E00] text-white flex items-center justify-center border-2 border-white shadow-sm cursor-pointer hover:bg-[#e65300] transition-colors"
          >
            <EditIcon />
          </button>
        </div>

        <div className="text-center">
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">{username}</h2>
          <p className="text-xs font-medium text-slate-400">@{handle}</p>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl py-2.5 text-center shadow-sm shadow-slate-900/5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Vaults</p>
            <p className="text-base font-semibold text-slate-800 mt-0.5">{vaultsCount}</p>
          </div>
          <div className="flex-1 bg-white border border-slate-200/60 rounded-2xl py-2.5 text-center shadow-sm shadow-slate-900/5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Points</p>
            <p className="text-base font-semibold text-slate-800 mt-0.5">{points.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Progressive identity */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h3 className="text-sm font-semibold text-slate-800 tracking-tight">Progressive Identity</h3>
          <p className="text-xs font-normal text-slate-400">Verify your account to unlock premium vaults</p>
        </div>

        {/* Level 1 - Phone Verified */}
        <div className={`rounded-2xl border p-4 space-y-2 ${phoneVerified ? 'bg-emerald-50/60 border-emerald-200/70' : 'bg-white border-slate-200/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Level 1</span>
            {phoneVerified && <CheckBadgeIcon className="text-emerald-500" />}
          </div>
          <h4 className="text-sm font-semibold text-slate-800">Phone Verified</h4>
          <p className="text-xs font-normal text-slate-500">Basic security enabled via SMS 2FA.</p>
          {phoneVerified && (
            <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-emerald-600">✓ Verified</span>
          )}
        </div>

        {/* Level 2 - Identity Details */}
        <div className={`rounded-2xl border p-4 space-y-2 ${identityVerified ? 'bg-emerald-50/60 border-emerald-200/70' : 'bg-orange-50/40 border-orange-200/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Level 2</span>
            {identityVerified && <CheckBadgeIcon className="text-emerald-500" />}
          </div>
          <h4 className="text-sm font-semibold text-slate-800">Identity Details</h4>
          <p className="text-xs font-normal text-slate-500">Required for cross-chain transactions.</p>
          {!identityVerified && (
            <button
              onClick={onVerifyIdentity}
              className="w-full mt-1 py-2.5 rounded-xl bg-[#FF5E00] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#e65300] active:scale-95 transition-all cursor-pointer"
            >
              Level Up
            </button>
          )}
        </div>

        {/* Level 3 - Community Trust */}
        <div className={`rounded-2xl border p-4 space-y-2 ${communityTrustUnlocked ? 'bg-emerald-50/60 border-emerald-200/70' : 'bg-slate-50 border-slate-200/60'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Level 3</span>
            {!communityTrustUnlocked && <LockIcon className="text-slate-300" />}
          </div>
          <h4 className="text-sm font-semibold ${communityTrustUnlocked ? 'text-slate-800' : 'text-slate-400'}">Community Trust</h4>
          <p className="text-xs font-normal text-slate-400">The ultimate badge of a trusted STELLA Vault node.</p>
          {!communityTrustUnlocked && (
            <button
              disabled
              className="w-full mt-1 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider cursor-not-allowed"
            >
              Locked
            </button>
          )}
        </div>
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 justify-center bg-white border border-slate-200/60 rounded-2xl py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <SettingsIcon className="text-[#FF5E00]" />
          Settings
        </button>
        <button
          onClick={onOpenSecurity}
          className="flex items-center gap-2 justify-center bg-white border border-slate-200/60 rounded-2xl py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <SecurityIcon className="text-[#3B82F6]" />
          Security
        </button>
        <button
          onClick={onOpenSupport}
          className="flex items-center gap-2 justify-center bg-white border border-slate-200/60 rounded-2xl py-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
        >
          <SupportIcon className="text-[#FF5E00]" />
          Support
        </button>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 justify-center bg-white border border-slate-200/60 rounded-2xl py-3.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 active:scale-95 transition-all cursor-pointer"
        >
          <LogoutIcon />
          Log Out
        </button>
      </div>
    </div>
  );
}