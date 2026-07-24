'use client';

import React from 'react';
import Image from 'next/image';
import VaultCore from '@/components/dashboard/VaultCore';
import { EyeIcon, DepositIcon, WithdrawIcon, CreateIcon } from '@/app/icons';
import type { Panel } from '@/lib/dashboardTypes';

interface VaultZoneProps {
  loading: boolean;
  showBalance: boolean;
  onToggleBalance: () => void;
  totalEquivalentInPhp: number;
  walletUsdcBalance: number;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  goalProgress: number;
  vaultLevel: number;
  vaultName?: string;
  targetLabel?: string;
  members?: { id: string; initial: string; color?: string }[];
  onViewVaultDetails?: () => void;
}

export default function VaultZone({
  loading,
  showBalance,
  onToggleBalance,
  totalEquivalentInPhp,
  walletUsdcBalance,
  panel,
  setPanel,
  goalProgress,
  vaultLevel,
  vaultName,
  targetLabel,
  members,
  onViewVaultDetails,
}: VaultZoneProps) {
  return (
    <div className="mx-6 mt-6 space-y-5">
      <div className="p-6 rounded-3xl bg-linear-to-br from-[#FFB238] via-[#FF9F1C] to-[#F37A00] text-white shadow-[0_18px_30px_-14px_rgba(230,80,0,0.40)] relative overflow-hidden">
        <Image
          src="/safeIcon.png"
          alt=""
          aria-hidden="true"
          width={176}
          height={176}
          className="absolute right-6 top-1/2 -translate-y-1/2 w-40 h-40 object-contain pointer-events-none select-none"
        />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.14em] uppercase font-semibold text-white/80">Total Balance</span>
          </div>

          <div className="flex items-baseline gap-1.5 mt-3">
            <span className="text-lg font-semibold text-white/85">₱</span>
            {loading ? (
              <h1 className="text-xl font-light text-white/60">Loading…</h1>
            ) : (
              <h1 className="text-[2.6rem] font-semibold tracking-tight leading-none">
                {showBalance ? totalEquivalentInPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '••••••'}
              </h1>
            )}
            <button
              onClick={onToggleBalance}
              className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 self-center"
              aria-label="Toggle balance visibility"
            >
              <EyeIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-xs font-medium tracking-wide text-white/80 flex items-center gap-1.5 pt-1">
            {showBalance ? `≈ ${walletUsdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC` : '•••••• USDC'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 px-2">
        {([
          { key: 'deposit' as Panel, label: 'Deposit', Icon: DepositIcon },
          { key: 'withdraw' as Panel, label: 'Withdraw', Icon: WithdrawIcon },
          { key: 'create' as Panel, label: 'Create Vault', Icon: CreateIcon },
        ]).map(({ key, label, Icon }) => {
          const isActive = panel === key;
          return (
            <button
              key={key}
              onClick={() => setPanel(key)}
              className="flex flex-col items-center gap-2 group"
            >
              <span
                className={`flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-200 active:scale-90 group-hover:scale-[1.05] ${
                  isActive
                    ? 'bg-linear-to-b from-white to-orange-50/70 border-[#FF9F1C] text-[#FF9F1C] shadow-[0_6px_18px_-6px_rgba(255,159,28,0.55)] ring-4 ring-orange-100/70'
                    : 'bg-linear-to-b from-white to-slate-50 border-slate-200 text-slate-500 shadow-[0_3px_10px_-4px_rgba(15,23,42,0.15)] group-hover:border-orange-200 group-hover:text-[#FF9F1C]'
                }`}
              >
                <Icon className="w-5.5 h-5.5" />
              </span>
              <span className={`text-[10px] tracking-wider uppercase font-semibold px-2.5 py-1 rounded-full transition-colors ${
                isActive ? 'text-orange-700 bg-orange-50 border border-orange-200' : 'text-slate-500'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 mb-6 flex flex-col items-center">
        <VaultCore
          goalProgress={goalProgress}
          vaultLevel={vaultLevel}
          vaultName={vaultName}
          targetLabel={targetLabel}
          members={members}
          onViewDetails={onViewVaultDetails}
        />
      </div>
    </div>
  );
}