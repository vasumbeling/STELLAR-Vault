'use client';

import React from 'react';
import { EyeIcon, SendIcon, ReceiveIcon } from '@/app/icons';
import type { Panel } from '@/lib/dashboardTypes';
import type { HistoryEntry } from '@/lib/history';

interface WalletZoneProps {
  loading: boolean;
  showBalance: boolean;
  onToggleBalance: () => void;
  totalEquivalentInPhp: number;
  walletUsdcBalance: number;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  history: HistoryEntry[];
  onSeeAllActivity: () => void;
}

export default function WalletZone({
  loading,
  showBalance,
  onToggleBalance,
  totalEquivalentInPhp,
  walletUsdcBalance,
  panel,
  setPanel,
  history,
  onSeeAllActivity,
}: WalletZoneProps) {
  return (
    <div className="mx-6 mt-6 space-y-5">
      <div className="p-6 rounded-3xl bg-linear-to-br from-cyan-400 via-cyan-500 to-blue-600 text-white shadow-[0_18px_30px_-14px_rgba(8,145,178,0.40)] relative overflow-hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-40 h-40 text-white/15 pointer-events-none select-none"
        >
          <rect x="2" y="6" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 10h20" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="17" cy="15" r="1.6" fill="currentColor" />
          <path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.2" />
        </svg>

        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-[0.14em] uppercase font-semibold text-white/80">Spendable Balance</span>
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

      <div className="grid grid-cols-2 gap-4 px-2">
        {([
          { key: 'send' as Panel, label: 'Send', Icon: SendIcon },
          { key: 'receive' as Panel, label: 'Receive', Icon: ReceiveIcon },
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
                    ? 'bg-linear-to-b from-white to-cyan-50/70 border-cyan-400 text-cyan-500 shadow-[0_6px_18px_-6px_rgba(34,211,238,0.55)] ring-4 ring-cyan-100/70'
                    : 'bg-linear-to-b from-white to-slate-50 border-slate-200 text-slate-500 shadow-[0_3px_10px_-4px_rgba(15,23,42,0.15)] group-hover:border-cyan-200 group-hover:text-cyan-500'
                }`}
              >
                <Icon className="w-5.5 h-5.5" />
              </span>
              <span className={`text-[10px] tracking-wider uppercase font-semibold px-2.5 py-1 rounded-full transition-colors ${
                isActive ? 'text-cyan-700 bg-cyan-50 border border-cyan-200' : 'text-slate-500'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Recent activity</h3>
          <button
            onClick={onSeeAllActivity}
            className="text-[11px] font-semibold text-cyan-600"
          >
            See all
          </button>
        </div>
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="p-4 rounded-2xl bg-white border border-slate-100 text-xs text-slate-400 text-center">
              No recent activity yet.
            </p>
          ) : (
            history.slice(0, 3).map((entry) => {
              const isCredit = entry.amount >= 0;
              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)] flex items-center gap-3"
                >
                  <span
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      isCredit ? 'bg-cyan-50 text-cyan-500' : 'bg-amber-50 text-[#FF9F1C]'
                    }`}
                  >
                    {isCredit ? <ReceiveIcon className="w-4 h-4" /> : <SendIcon className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{entry.title}</p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{entry.description}</p>
                  </div>
                  <span className={`text-xs font-semibold shrink-0 ${isCredit ? 'text-cyan-600' : 'text-slate-800'}`}>
                    {isCredit ? '+' : ''}{entry.amount.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}