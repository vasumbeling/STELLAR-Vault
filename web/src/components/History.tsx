'use client';

import React from 'react';
import { type HistoryEntry } from '@/lib/history';

interface HistoryProps {
  history: HistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
}

function entryVisual(kind: string) {
  switch (kind) {
    case 'withdraw':
      return { bg: 'bg-[#FFEFE6]', fg: 'text-[#FF5E00]', icon: '↑' };
    case 'transfer':
      return { bg: 'bg-[#E3FCFC]', fg: 'text-[#00A3A3]', icon: '➤' };
    default:
      return { bg: 'bg-[#E6FBF3]', fg: 'text-[#10B981]', icon: '↓' };
  }
}

export default function History({ history, loading, onRefresh }: HistoryProps) {
  return (
    // Root outer wrapper now mirrors Profile's boosted horizontal edge bounds
    <div className="px-6 py-2 space-y-6 animate-fade-in">
      
      {/* Header element padding matches Profile layout frame */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xl font-black text-[#FF5E00] tracking-tight">History</h3>
        <button 
          onClick={onRefresh} 
          disabled={loading} 
          className="px-5 py-2 text-xs font-black bg-[#9AFAFA] text-[#0F4F53] rounded-full shadow-md shadow-cyan-300/10 hover:bg-[#7becec] active:scale-95 disabled:opacity-50 uppercase tracking-widest transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-1.5 justify-center">
              <svg className="animate-spin h-3 w-3 text-[#0F4F53]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Polling Network…
            </span>
          ) : (
            'Sync Data'
          )}
        </button>
      </div>
      
      {/* Content wrapper layout containing the items stack */}
      <div className="space-y-3">
        {history.length === 0 ? (
          // Empty State block boosted to matching p-6 configuration
          <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-medium text-slate-400 text-center shadow-md shadow-slate-900/1">
            No localized network block events recorded on this public key.
          </p>
        ) : (
          history.map((entry) => {
            const v = entryVisual(entry.kind);
            return (
              // Individual cards boosted to clean p-6 layout configuration
              <div key={entry.id} className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/1 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full ${v.bg} ${v.fg} flex items-center justify-center shrink-0 font-black shadow-inner text-sm`}>
                  {v.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-800 truncate">{entry.title}</h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">{entry.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-slate-800">{entry.amount.toFixed(2)}</span>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {new Date(entry.timestamp).toLocaleDateString()}
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