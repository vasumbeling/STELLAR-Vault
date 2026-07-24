'use client';

import React, { useState } from 'react';

export interface VaultCoreMember {
  id: string;
  initial: string;
  color?: string; // tailwind bg-* class, optional override
}

interface VaultCoreProps {
  goalProgress?: number;     // 0–100
  vaultLevel?: number;
  vaultName?: string;
  targetLabel?: string;      // e.g. "₱15,000 of ₱25,000"
  members?: VaultCoreMember[]; // omit/empty for personal vaults
  onViewDetails?: () => void;
}

const MEMBER_COLORS = ['bg-[#FF9F1C]', 'bg-cyan-500', 'bg-slate-700', 'bg-amber-500'];

// TODO: hardcoded example data — replace with real values from vaultSummary / state
// once the contract read layer exposes a goal target + member list.
const EXAMPLE_MEMBERS: VaultCoreMember[] = [
  { id: '1', initial: 'M' },
  { id: '2', initial: 'J' },
  { id: '3', initial: 'S' },
];

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.4" fill="currentColor" />
    </svg>
  );
}

function VaultDoorCore({
  radius,
  circumference,
  strokeDashoffset,
  vaultLevel,
  clampedProgress,
  size = 'lg',
}: {
  radius: number;
  circumference: number;
  strokeDashoffset: number;
  vaultLevel: number;
  clampedProgress: number;
  size?: 'lg' | 'sm';
}) {
  const outerSize = size === 'lg' ? 'w-64 h-64' : 'w-64 h-64';
  const coreSize = size === 'lg' ? 'w-36 h-36' : 'w-36 h-36';
  const rivetCount = 12;

  return (
    <div className={`relative ${outerSize} flex items-center justify-center`}>
      {/* Soft glow */}
      <div className="absolute inset-0 rounded-full bg-linear-to-br from-orange-200/25 to-[#FF9F1C]/10 blur-2xl" />

      {/* Progress ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
        <circle cx="128" cy="128" r={radius} stroke="#F1F5F9" strokeWidth="10" fill="none" />
        <circle
          cx="128" cy="128" r={radius}
          stroke="#FF9F1C" strokeWidth="10" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Vault door rivets, sit just inside the ring */}
      <svg className="absolute w-[184px] h-[184px]" viewBox="0 0 184 184">
        {[...Array(rivetCount)].map((_, i) => {
          const angle = (i / rivetCount) * 2 * Math.PI;
          const x = 92 + 84 * Math.cos(angle);
          const y = 92 + 84 * Math.sin(angle);
          return <circle key={i} cx={x} cy={y} r="1.6" fill="#E9D8B8" />;
        })}
      </svg>

      {/* Vault door core — brushed metal look */}
      <div
        className={`relative z-10 ${coreSize} rounded-full flex flex-col items-center justify-center border border-amber-100/70 shadow-[0_4px_20px_-4px_rgba(255,159,28,0.25),inset_0_1px_2px_rgba(255,255,255,0.9)]`}
        style={{
          background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #fdf6ec 45%, #f6e9d3 100%)',
        }}
      >
        {/* inner ring, like a vault door seam */}
        <div className="absolute inset-2 rounded-full border border-amber-200/50" />

        <LockIcon className="w-4 h-4 text-[#FF9F1C] mb-1" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Level {vaultLevel}
        </span>
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight leading-none mt-0.5">
          {clampedProgress}%
        </h3>
        <p className="text-[11px] font-medium text-[#FF9F1C] mt-1">of goal</p>
      </div>
    </div>
  );
}

export default function VaultCore({
  goalProgress = 72,
  vaultLevel = 3,
  vaultName = 'Emergency Fund',
  targetLabel = '₱18,000 of ₱25,000',
  members = EXAMPLE_MEMBERS,
  onViewDetails,
}: VaultCoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const clampedProgress = Math.max(0, Math.min(100, goalProgress));
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  const orbitMembers = members.slice(0, 3);

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full font-sans tracking-tight">
      <button
        onClick={() => setIsExpanded(true)}
        className="relative w-64 h-64 flex items-center justify-center group cursor-pointer hover:scale-[1.015] active:scale-[0.98] transition-transform duration-300"
        aria-label={`Open ${vaultName} details`}
      >
        {/* Static orbit avatars — collaborative vaults only */}
        {orbitMembers.map((member, i) => {
          const angle = (i / orbitMembers.length) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + 47 * Math.cos(rad);
          const y = 50 + 47 * Math.sin(rad);
          return (
            <div
              key={member.id}
              className={`absolute z-20 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center shadow-sm text-white text-[10px] font-bold ${
                member.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length]
              }`}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
            >
              {member.initial}
            </div>
          );
        })}

        <VaultDoorCore
          radius={radius}
          circumference={circumference}
          strokeDashoffset={strokeDashoffset}
          vaultLevel={vaultLevel}
          clampedProgress={clampedProgress}
        />
      </button>

      <p className="mt-4 text-sm font-semibold text-slate-800">{vaultName}</p>
      {targetLabel && <p className="text-xs text-slate-400 mt-0.5">{targetLabel}</p>}

      {/* Expanded — centered, minimal, no starfield */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md animate-fadeIn"
          onClick={() => setIsExpanded(false)}
        >
          <div
            className="relative w-72 flex flex-col items-center animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -top-12 right-0 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>

            <VaultDoorCore
              radius={radius}
              circumference={circumference}
              strokeDashoffset={strokeDashoffset}
              vaultLevel={vaultLevel}
              clampedProgress={clampedProgress}
            />

            <p className="mt-5 text-base font-semibold text-slate-800">{vaultName}</p>
            {targetLabel && <p className="text-xs text-slate-400 mt-0.5">{targetLabel}</p>}

            {members.length > 0 && (
              <div className="flex items-center -space-x-2 mt-3">
                {members.map((member, i) => (
                  <div
                    key={member.id}
                    className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[11px] font-bold text-white ${
                      member.color ?? MEMBER_COLORS[i % MEMBER_COLORS.length]
                    }`}
                  >
                    {member.initial}
                  </div>
                ))}
              </div>
            )}

            {onViewDetails && (
              <button
                onClick={() => { setIsExpanded(false); onViewDetails(); }}
                className="mt-6 px-6 py-2.5 rounded-full bg-[#FF9F1C] text-white text-xs font-semibold active:scale-[0.98] transition-transform"
              >
                View full vault
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}