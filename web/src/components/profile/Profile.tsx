'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Level2Verification from '@/components/verification/Level2Verification';
import { CheckBadgeIcon, LockIcon, EditIcon, SettingsIcon, SparkleIcon, VaultIcon, StarIcon, ShieldCheckIcon} from '@/app/icons';

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

type StepState = 'done' | 'current' | 'locked';


function IdentityStep({
  index,
  state,
  label,
  sublabel,
  isLast,
  rightSlot,
  children,
}: {
  index: number;
  state: StepState;
  label: string;
  sublabel?: string;
  isLast?: boolean;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5 px-4 py-3.5">
      {/* Rail: marker + connecting line */}
      <div className="flex flex-col items-center">
        <span
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 transition-colors ${
            state === 'done'
              ? 'bg-emerald-500 text-white'
              : state === 'current'
              ? 'bg-[#FF9F1C] text-white ring-4 ring-orange-100'
              : 'bg-slate-100 text-slate-400'
          }`}
        >
          {state === 'done' ? <CheckBadgeIcon className="w-3.5 h-3.5" /> : index}
        </span>
        {!isLast && (
          <span
            className={`w-px flex-1 mt-1.5 min-h-4 ${state === 'done' ? 'bg-emerald-200' : 'bg-slate-100'}`}
          />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold tracking-tight ${state === 'locked' ? 'text-slate-400' : 'text-slate-800'}`}>
            {label}
          </span>
          {rightSlot}
        </div>
        {sublabel && (
          <p className={`text-[11px] mt-0.5 ${state === 'locked' ? 'text-slate-300' : 'text-slate-400'}`}>{sublabel}</p>
        )}
        {children}
      </div>
    </div>
  );
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
  const [showLevel2, setShowLevel2] = useState(false);

  const handleLevelUpClick = () => {
    setShowLevel2(true);
    onVerifyIdentity?.();
  };

  const level = phoneVerified ? (identityVerified ? (communityTrustUnlocked ? 3 : 2) : 1) : 0;

  const journeyMessage =
    level >= 3
      ? "You've unlocked every level. Nicely done!"
      : level >= 1
      ? 'Your journey has just begun. Keep going!'
      : 'Verify your phone to get started.';

  return (
    <div className="px-6 py-2 space-y-7 animate-fade-in">
      {/* Top bar */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">Profile</h3>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center text-slate-400 hover:text-slate-600">
          <SettingsIcon className="w-5 h-5 transition-colors" />
        </button>
      </div>

      {/* Avatar + identity */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-full flex justify-center py-2">
          {/* Decorative sparkles */}
          <SparkleIcon className="absolute left-8 top-4 w-3.5 h-3.5 text-orange-300/70" />
          <SparkleIcon className="absolute right-6 top-9 w-2.5 h-2.5 text-orange-200/80" />
          <SparkleIcon className="absolute right-14 bottom-2 w-2 h-2 text-orange-200/70" />
          <SparkleIcon className="absolute left-4 bottom-6 w-2 h-2 text-orange-200/70" />

          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-orange-50 ring-2 ring-[#FF9F1C]/70 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full overflow-hidden relative bg-white shadow-inner">
                <Image
                  src={avatarSrc}
                  alt="Profile avatar"
                  fill
                  priority
                  sizes="96px"
                  className="object-contain p-3"
                />
              </div>
            </div>
            <button
              type="button"
              aria-label="Edit avatar"
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-white text-[#FF5E00] flex items-center justify-center shadow-md cursor-pointer hover:bg-orange-50 active:scale-90 transition-all"
            >
              <EditIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{username}</h2>
            {level > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF5E00] bg-orange-50 rounded-full px-2 py-1">
                LVL {level}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-400">@{handle}</p>
        </div>

        <div className="flex items-center gap-1.5 bg-orange-50 rounded-full px-4 py-2">
          <StarIcon className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
          <span className="text-xs font-medium text-orange-900/70">{journeyMessage}</span>
        </div>

        <div className="flex items-center gap-4 w-full max-w-xs">
          <div className="flex-1 flex items-center gap-3 bg-white border border-slate-200/60 rounded-2xl px-4 py-3.5 shadow-xs hover:shadow-sm transition-all">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-50 text-[#FF9F1C] shrink-0">
              <VaultIcon className="w-4.5 h-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vaults</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{vaultsCount}</p>
              <p className="text-[10px] text-slate-400">Active vaults</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-3 bg-white border border-slate-200/60 rounded-2xl px-4 py-3.5 shadow-xs hover:shadow-sm transition-all">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-50 text-[#FF9F1C] shrink-0">
              <StarIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Points</p>
              <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">{points.toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">Total points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progressive identity */}
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 px-1">
          <ShieldCheckIcon className="w-5 h-5 text-[#FF9F1C] shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Progressive Identity</h3>
            <p className="text-xs font-normal text-slate-400 mt-0.5">Verify your account to unlock premium vaults</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
          <IdentityStep
            index={1}
            state="done"
            label="Phone Verified"
            sublabel={phoneVerified ? phoneNumber : undefined}
            rightSlot={
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2.5 py-1 shrink-0">
                <CheckBadgeIcon className="w-3 h-3" />
                Verified
              </span>
            }
          />

          <IdentityStep
            index={2}
            state={identityVerified ? 'done' : 'current'}
            label="Identity Details"
            sublabel={identityVerified ? 'Verified' : 'Government ID + selfie check'}
          >
            {!identityVerified && (
              <button
                onClick={handleLevelUpClick}
                className="mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#FF9F1C] to-[#F37A00] text-white text-xs font-bold uppercase tracking-wider shadow-sm shadow-orange-500/20 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
              >
                Level Up
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20">↑</span>
              </button>
            )}
          </IdentityStep>

          <IdentityStep
            index={3}
            state={communityTrustUnlocked ? 'done' : 'locked'}
            label="Community Trust"
            sublabel={communityTrustUnlocked ? 'Unlocked' : 'Unlocks after Level 2'}
            isLast
            rightSlot={
              !communityTrustUnlocked && (
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 shrink-0">
                  <LockIcon className="w-3.5 h-3.5" />
                </span>
              )
            }
          />
        </div>

        <div className="flex items-center gap-2 bg-orange-50/70 rounded-xl px-4 py-3">
          <SparkleIcon className="w-3.5 h-3.5 text-[#FF9F1C] shrink-0" />
          <p className="text-xs text-orange-900/70">Higher levels unlock bigger vault limits and more features!</p>
        </div>
      </div>

      {/* Level 2 verification modal */}
      {showLevel2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLevel2(false);
          }}
        >
          <div className="w-full max-w-md transform scale-100 transition-transform">
            <Level2Verification
              currentPoints={points}
              verifiedPhone={phoneNumber}
              onClose={() => setShowLevel2(false)}
              onComplete={() => {
                setShowLevel2(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}