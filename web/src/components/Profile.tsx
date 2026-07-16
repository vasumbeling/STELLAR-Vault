'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Level2Verification from './verification/Level2Verification';
import { CheckBadgeIcon, LockIcon, EditIcon, SettingsIcon } from '@/app/icons';

interface ProfileProps {
  publicKey: string | null;
  phpRate: number;
  purchasingPowerSaved: number;
  copied: boolean;
  onCopyAddress: () => void;
  loading: boolean;
  onRefresh: () => void;
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
  phoneNumber?: string;
  identityVerified?: boolean;
  communityTrustUnlocked?: boolean;
  onVerifyIdentity?: () => void;
  onOpenSettings?: () => void;
}

export default function Profile({
  wallet,
  username = 'Starry Voyager',
  handle = 'stella_user_882',
  vaultsCount = 12,
  points = 2450,
  avatarSrc = '/stellamascot.png',
  phoneVerified = true,
  phoneNumber = '+63 917 •• •• 213',
  identityVerified = false,
  communityTrustUnlocked = false,
  onVerifyIdentity,
  onOpenSettings,
}: ProfileProps) {
  const { network } = wallet || {};

  // Controls the Level 2 verification modal. Kept local to Profile since the
  // gate + wizard is self-contained; onVerifyIdentity is still fired so a
  // parent (e.g. to refetch user/points) can react if it needs to.
  const [showLevel2, setShowLevel2] = useState(false);

  const handleLevelUpClick = () => {
    setShowLevel2(true);
    onVerifyIdentity?.();
  };

  return (
    <div className="px-6 py-2 space-y-7 animate-fade-in">
          {/* Top bar */}
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">Profile</h3>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open settings"
              className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600"
            >
              <SettingsIcon className="w-5 h-5 transition-colors" />
            </button>
          </div>

      {/* Avatar + identity */}
      <div className="flex flex-col items-center gap-3">
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

        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100">
          {/* Level 1 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300 w-4">1</span>
              <span className="text-sm font-medium text-slate-700">Phone Verified</span>
            </div>
            {phoneVerified && <CheckBadgeIcon className="text-emerald-500 shrink-0" />}
          </div>

          {/* Level 2 */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300 w-4">2</span>
                <span className="text-sm font-medium text-slate-700">Identity Details</span>
              </div>
              {identityVerified && <CheckBadgeIcon className="text-emerald-500 shrink-0" />}
            </div>
            {!identityVerified && (
              <button
                onClick={handleLevelUpClick}
                className="w-full py-2 rounded-xl bg-[#FF5E00] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#e65300] active:scale-95 transition-all cursor-pointer"
              >
                Level Up
              </button>
            )}
          </div>

          {/* Level 3 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300 w-4">3</span>
              <span className={`text-sm font-medium ${communityTrustUnlocked ? 'text-slate-700' : 'text-slate-400'}`}>Community Trust</span>
            </div>
            {communityTrustUnlocked ? (
              <CheckBadgeIcon className="text-emerald-500 shrink-0" />
            ) : (
              <LockIcon className="text-slate-300 shrink-0" />
            )}
          </div>
        </div>
      </div>

      {/* Level 2 verification modal */}
      {showLevel2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLevel2(false);
          }}
        >
          <Level2Verification
            currentPoints={points}
            verifiedPhone={phoneNumber}
            onClose={() => setShowLevel2(false)}
            onComplete={() => {
              setShowLevel2(false);
            }}
          />
        </div>
      )}
    </div>
  );
}