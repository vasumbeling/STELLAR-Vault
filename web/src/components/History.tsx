'use client';

import React from 'react';
import { type HistoryEntry } from '@/lib/history';
import { RefreshIcon } from '@/app/icons';

interface HistoryProps {
  history: HistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
}

function entryVisual(kind: string) {
  switch (kind) {
    case 'withdraw':
      return { bg: 'bg-[#FFEFE6]', fg: 'text-[#FF5E00]', icon: '↑' };
    case 'send':
      return { bg: 'bg-[#E3FCFC]', fg: 'text-[#00A3A3]', icon: '➤' };
    default:
      return { bg: 'bg-[#E6FBF3]', fg: 'text-[#10B981]', icon: '↓' };
  }
}

export default function History({ history, loading, onRefresh }: HistoryProps) {
  // Determine state color based on activity and actions needed
  const getIconColorClass = () => {
    if (loading) return 'text-cyan-500 animate-spin';
    if (history.length === 0) return 'text-orange-500'; // Needs action / empty warning
    return 'text-slate-400'; // Inactive / resting
  };

  return (
    <div className="px-6 py-2 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">History</h3>
        <button 
          onClick={onRefresh} 
          disabled={loading} 
          className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
          aria-label="Sync Data"
        >
          <RefreshIcon className={`w-5 h-5 transition-colors ${getIconColorClass()}`} />
        </button>
      </div>
      
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {history.length === 0 ? (
          <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-normal text-slate-400 text-center shadow-md shadow-slate-900/5">
            No localized network block events recorded on this public key.
          </p>
        ) : (
          history.map((entry) => {
            const v = entryVisual(entry.kind);
            return (
              <div key={entry.id} className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full ${v.bg} ${v.fg} flex items-center justify-center shrink-0 font-bold shadow-inner text-sm`}>
                  {v.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-xs text-slate-800 truncate">{entry.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-normal">{entry.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-slate-800">{entry.amount.toFixed(2)}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
                    {new Date(entry.timestamp).toLocaleDateString()}{' '}
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}