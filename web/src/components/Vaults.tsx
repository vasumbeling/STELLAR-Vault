'use client';
import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/wallet';

interface VaultData {
  id: string;
  name: string;
  description: string | null;
  goalType: string;
  targetAmount: number;
  balance: number;
  status: string;
  vaultType: string;
  ownerPubkey: string;
  createdAt: string;
}

interface VaultsProps {
  publicKey: string | null;
  loading?: boolean;
}

type VaultSubTab = 'owned' | 'joined';

function VaultCard({ vault }: { vault: VaultData }) {
  const progress = vault.targetAmount > 0
    ? Math.min(100, (vault.balance / vault.targetAmount) * 100)
    : 0;

  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/1 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-slate-800">{vault.name}</h4>
        <span className="rounded-full bg-orange-50 border border-orange-100/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#FF5E00]">
          {vault.vaultType}
        </span>
      </div>
      {vault.description && (
        <p className="text-[10px] text-slate-400 font-medium">{vault.description}</p>
      )}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-bold text-slate-500">
          <span>{vault.balance.toFixed(2)} / {vault.targetAmount.toFixed(2)} USDC</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FF5E00] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
        vault.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}>
        {vault.status}
      </span>
    </div>
  );
}

export default function Vaults({ publicKey, loading: parentLoading }: VaultsProps) {
  const [subTab, setSubTab] = useState<VaultSubTab>('owned');
  const [owned, setOwned] = useState<VaultData[]>([]);
  const [joined, setJoined] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setOwned([]);
      setJoined([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/vaults/mine');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load vaults');
      setOwned(data.owned ?? []);
      setJoined(data.joined ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load vaults');
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const isLoading = loading || parentLoading;
  const activeList = subTab === 'owned' ? owned : joined;

  return (
    <div className="px-6 py-2 space-y-6 animate-fade-in">

      {/* Header — matches Profile/History layout frame exactly */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-black text-[#FF5E00] tracking-tight">Vaults</h3>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-5 py-2 text-xs font-black bg-[#9AFAFA] text-[#0F4F53] rounded-full shadow-md shadow-cyan-300/10 hover:bg-[#7becec] active:scale-95 disabled:opacity-50 uppercase tracking-widest transition-all duration-200 cursor-pointer"
        >
          {isLoading ? (
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

      {!publicKey ? (
        <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-medium text-slate-400 text-center shadow-md shadow-slate-900/1">
          Log in to view your vaults.
        </p>
      ) : (
        <>
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
              <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
            </div>
          )}

          {/* Sub-tab switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSubTab('owned')}
              className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                subTab === 'owned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
              }`}
            >
              Owned {owned.length > 0 && `(${owned.length})`}
            </button>
            <button
              onClick={() => setSubTab('joined')}
              className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                subTab === 'joined' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
              }`}
            >
              Joined {joined.length > 0 && `(${joined.length})`}
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-medium text-slate-400 text-center shadow-md shadow-slate-900/1">
                Loading…
              </p>
            ) : activeList.length === 0 ? (
              <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-medium text-slate-400 text-center shadow-md shadow-slate-900/1">
                {subTab === 'owned'
                  ? "You don't own any vaults yet."
                  : "You haven't joined any vaults yet."}
              </p>
            ) : (
              activeList.map((v) => <VaultCard key={v.id} vault={v} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}