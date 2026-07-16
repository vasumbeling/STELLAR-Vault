'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch, walletService, signWithCurrentAccount } from '@/lib/wallet';
import { buildDistributeXDR } from '@/lib/contract';
import { submitSignedXDR, pollTransaction } from '@/lib/payment';
import { depositUSDC, withdrawUSDC } from '@/lib/transfer';
import InviteMemberModal from './vault/InviteMemberModal';
import PendingConfirmations from './vault/PendingConfirmations';
import MyInvitations from './MyInvitations';
import { RefreshIcon } from '@/app/icons';

interface VaultData {
  id: string;
  onChainVaultId: string; // numeric on-chain vault ID, saved at creation time
  name: string;
  description: string | null;
  goalType: string;
  targetAmount: number;
  balance: number;
  status: string;
  vaultType: string;
  ownerPubkey: string;
  createdAt: string;
  withdrawable?: boolean;
}

interface VaultsProps {
  publicKey: string | null;
  loading?: boolean;
  onWalletChanged?: () => void | Promise<void>;
  focusVaultId?: string | null;
  onFocusHandled?: () => void;
}

type VaultSubTab = 'owned' | 'joined';
type MoneyAction = 'deposit' | 'withdraw';

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

function VaultCard({
  vault,
  onChanged,
  isOwned,
  highlighted,
}: {
  vault: VaultData;
  onChanged: () => void;
  isOwned: boolean;
  highlighted?: boolean;
}) {
  const progress = vault.targetAmount > 0
    ? Math.min(100, (vault.balance / vault.targetAmount) * 100)
    : 0;

  const [showInvite, setShowInvite] = useState(false);
  const [action, setAction] = useState<MoneyAction | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const [showHighlight, setShowHighlight] = useState(false);

  useEffect(() => {
    if (highlighted) {
      setShowHighlight(true);
      const t = setTimeout(() => setShowHighlight(false), 2500);
      return () => clearTimeout(t);
    }
  }, [highlighted]);

  const openAction = (a: MoneyAction) => {
    setAction(a);
    setAmount('');
    setError('');
    setNeedsPin(false);
    setPinInput('');
    setPinError('');
  };

  const closeAction = () => {
    setAction(null);
    setBusy(false);
    setNeedsPin(false);
  };

  const runAction = async () => {
    if (!action) return;
    setBusy(true);
    setError('');
    try {
      const fn = action === 'deposit' ? depositUSDC : withdrawUSDC;
      await fn(amount, vault.onChainVaultId, {
        onCompleted: async () => {
          onChanged();
        },
      });
      closeAction();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `${action} failed`;
      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setNeedsPin(true);
        setBusy(false);
        return;
      }
      setError(message);
      setBusy(false);
    }
  };

  const [distributing, setDistributing] = useState(false);
  const [distributeError, setDistributeError] = useState('');

  const runDistribute = async () => {
    setDistributing(true);
    setDistributeError('');
    try {
      const xdr = await buildDistributeXDR(vault.ownerPubkey, vault.onChainVaultId);
      const signedXdr = await signWithCurrentAccount(xdr);
      const hash = await submitSignedXDR(signedXdr);
      await pollTransaction(hash);
      onChanged();
    } catch (e: unknown) {
      setDistributeError(e instanceof Error ? e.message : 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const handleUnlockAndRetry = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      await walletService.unlockPinAccount(pinInput);
      setNeedsPin(false);
      setPinInput('');
      await runAction();
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  const withdrawDisabled = vault.vaultType !== 'Personal' || !vault.withdrawable;

  return (
    <div
      className={`p-6 rounded-3xl bg-white border shadow-md shadow-slate-900/5 space-y-3 transition-all duration-700 ${
        showHighlight
          ? 'border-[#FF9F1C] ring-2 ring-[#FF9F1C]/40'
          : 'border-slate-200/60'
      }`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{vault.name}</h4>
        <span className="rounded-full bg-orange-50 border border-orange-100/60 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#FF5E00]">
          {vault.vaultType}
        </span>
      </div>
      {vault.description && (
        <p className="text-xs text-slate-400 font-normal">{vault.description}</p>
      )}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-medium text-slate-500">
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
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        vault.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
      }`}>
        {vault.status}
      </span>

      {/* Deposit / Withdraw entry buttons */}
      {action === null && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => openAction('deposit')}
            className="py-2.5 rounded-xl bg-[#FF9F1C] text-white text-[11px] font-semibold uppercase tracking-wider hover:bg-[#FF8C00] active:scale-95 transition-all"
          >
            Deposit
          </button>
          <button
            onClick={() => openAction('withdraw')}
            disabled={withdrawDisabled}
            title={withdrawDisabled ? 'Withdrawals are only available for personal vaults once active' : undefined}
            className="py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-semibold uppercase tracking-wider hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-40 disabled:hover:bg-slate-100"
          >
            Withdraw
          </button>
        </div>
      )}

      {/* Amount entry + confirm */}
      {action !== null && !needsPin && (
        <div className="pt-1 space-y-2.5 border-t border-slate-100 mt-1">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light pt-2">
            {action === 'deposit' ? 'Deposit amount' : 'Withdraw amount'}
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={busy}
              className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-3.5 pr-12 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors"
            />
            <span className="absolute right-3.5 text-[10px] text-slate-400">USDC</span>
          </div>

          {error && <p className="text-[10px] text-rose-500">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={runAction}
              disabled={busy || !amount || Number(amount) <= 0}
              className="flex-1 py-2.5 rounded-xl bg-[#FF9F1C] text-white text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {busy && (
                <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {busy ? 'Processing…' : 'Confirm'}
            </button>
            <button
              onClick={closeAction}
              disabled={busy}
              className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[11px] uppercase tracking-wide text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PIN re-auth prompt */}
      {needsPin && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 mt-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-light">
            Enter PIN to continue
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="••••"
            disabled={unlocking}
            className="w-full rounded-xl bg-white border border-slate-100 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50"
          />
          {pinError && <p className="text-[10px] text-rose-500">{pinError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleUnlockAndRetry}
              disabled={unlocking || !pinInput}
              className="flex-1 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white py-2.5 text-[10px] uppercase tracking-widest font-normal disabled:opacity-40"
            >
              {unlocking ? 'Unlocking…' : 'Unlock & continue'}
            </button>
            <button
              onClick={closeAction}
              disabled={unlocking}
              className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Collaborative-vault owner controls: invite + on-chain confirmation */}
      {isOwned && vault.vaultType === 'Collaborative' && (
        <div className="pt-1 space-y-2 border-t border-slate-100 mt-1">
          {!showInvite ? (
            <button
              onClick={() => setShowInvite(true)}
              className="w-full py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Invite Member
            </button>
          ) : (
            <InviteMemberModal
              vaultId={vault.id}
              onClose={() => setShowInvite(false)}
              onSent={() => setShowInvite(false)}
            />
          )}
          <PendingConfirmations
            vaultId={vault.id}
            onChainVaultId={vault.onChainVaultId}
            ownerPubkey={vault.ownerPubkey}
            onConfirmed={onChanged}
          />
          {isOwned && vault.vaultType === 'Collaborative' && vault.status === 'GoalReached' && (
            <div className="pt-1">
              {distributeError && <p className="text-[10px] text-rose-500 pb-1.5">{distributeError}</p>}
              <button
                onClick={runDistribute}
                disabled={distributing}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50"
              >
                {distributing ? 'Distributing…' : 'Distribute to Members'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Vaults({
  publicKey,
  loading: parentLoading,
  onWalletChanged,
  focusVaultId,
  onFocusHandled,
}: VaultsProps) {
  const [subTab, setSubTab] = useState<VaultSubTab>('owned');
  const [owned, setOwned] = useState<VaultData[]>([]);
  const [joined, setJoined] = useState<VaultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setOwned([]);
      setJoined([]);
      setLoading(false);
      setHasLoadedOnce(true);
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
      setHasLoadedOnce(true);
    }
  }, [publicKey]);

  const handleVaultChanged = useCallback(async () => {
    await refresh();
    if (onWalletChanged) {
      await onWalletChanged();
    }
  }, [refresh, onWalletChanged]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusVaultId || (owned.length === 0 && joined.length === 0)) return;

    const inOwned = owned.some((v) => v.id === focusVaultId);
    const inJoined = joined.some((v) => v.id === focusVaultId);

    if (!inOwned && !inJoined) {
      // Not loaded yet, or vault not visible to this account — bail quietly.
      onFocusHandled?.();
      return;
    }

    setSubTab(inOwned ? 'owned' : 'joined');

    // Wait a tick for the tab switch to render the target card before scrolling.
    const timeout = setTimeout(() => {
      const el = cardRefs.current.get(focusVaultId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled?.();
    }, 50);

    return () => clearTimeout(timeout);
  }, [focusVaultId, owned, joined, onFocusHandled]);

  const isLoading = loading || parentLoading;
  const activeList = subTab === 'owned' ? owned : joined;
  const filteredList = search.trim()
    ? activeList.filter((v) =>
        v.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (v.description ?? '').toLowerCase().includes(search.trim().toLowerCase())
      )
    : activeList;


  return (
      <div className="px-6 py-2 space-y-6 animate-fade-in">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xl font-semibold text-[#FF5E00] tracking-tight">Vaults</h3>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Sync Data"
          >
            <RefreshIcon 
              className={`w-5 h-5 transition-colors ${
                isLoading 
                  ? 'text-cyan-500 animate-spin' 
                  : error 
                  ? 'text-orange-500' // Needs action if an error is present
                  : 'text-gray-400'
              }`} 
            />
          </button>
        </div>

      {!publicKey ? (
        <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-normal text-slate-400 text-center shadow-md shadow-slate-900/5">
          Log in to view your vaults.
        </p>
      ) : (
        <>
          <MyInvitations onResponded={refresh} focusVaultId={focusVaultId} onFocusHandled={onFocusHandled} />

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
              <p className="text-xs font-medium text-rose-600 leading-normal">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setSubTab('owned')}
              className={`py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all ${
                subTab === 'owned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
              }`}
            >
              Owned {owned.length > 0 && `(${owned.length})`}
            </button>
            <button
              onClick={() => setSubTab('joined')}
              className={`py-2 text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-all ${
                subTab === 'joined' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
              }`}
            >
              Joined {joined.length > 0 && `(${joined.length})`}
            </button>
          </div>

          <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vaults…"
            className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-9 pr-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0a7.5 7.5 0 10-10.6 0 7.5 7.5 0 0010.6 0z" />
          </svg>
        </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {isLoading && !hasLoadedOnce ? (
              <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-normal text-slate-400 text-center shadow-md shadow-slate-900/5">
                Loading…
              </p>
            ) : filteredList.length === 0 ? (
              <p className="p-6 rounded-3xl bg-white border border-slate-200/60 text-xs font-normal text-slate-400 text-center shadow-md shadow-slate-900/5">
                {search.trim()
                  ? 'No vaults match your search.'
                  : subTab === 'owned'
                    ? "You don't own any vaults yet."
                    : "You haven't joined any vaults yet."}
              </p>
            ) : (
              filteredList.map((v) => (
                <div
                  key={v.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(v.id, el);
                    else cardRefs.current.delete(v.id);
                  }}
                >
                  <VaultCard
                    vault={v}
                    onChanged={handleVaultChanged}
                    isOwned={subTab === 'owned'}
                    highlighted={v.id === focusVaultId}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}