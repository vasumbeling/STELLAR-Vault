'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch, walletService, signWithCurrentAccount } from '@/lib/wallet';
import { submitSignedXDR, pollTransaction } from '@/lib/payment';
import { depositUSDC, withdrawUSDC } from '@/lib/transfer';
import InviteMemberModal from '@/components/vault/InviteMemberModal';
import PendingConfirmations from '@/components/vault/PendingConfirmations';
import MyInvitations from '@/components/profile/MyInvitations';
import { RefreshIcon } from '@/app/icons';
import { buildDistributeXDR,
         buildUpdateGoalXDR, 
         buildUpdateLockXDR, 
         buildRemoveMemberXDR, 
         buildCloseVaultXDR } from '@/lib/contract';
import { createAppNotification } from '@/lib/notifications';

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

interface VaultMemberRow {
  id: string;
  vaultId: string;
  pubkey: string;
  role: string;
  addedAt: string;
}

interface VaultProposalRow {
  id: string;
  vaultId: string;
  proposedBy: string;
  type: 'edit_goal' | 'edit_lock' | 'delete';
  changes: { targetAmount?: number; lockUntil?: string } | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: string;
  approvals: { pubkey: string }[];
}

type VaultSubTab = 'owned' | 'joined';
type MoneyAction = 'deposit' | 'withdraw';

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

function VaultCard({
  vault,
  onChanged,
  isOwned,
  highlighted,
  publicKey,
}: {
  vault: VaultData;
  onChanged: () => void;
  isOwned: boolean;
  highlighted?: boolean;
  publicKey: string | null;
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

  // ---------- Manage section state ----------
  const [showManage, setShowManage] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState('');
  const [members, setMembers] = useState<VaultMemberRow[]>([]);
  const [proposals, setProposals] = useState<VaultProposalRow[]>([]);

  const [proposeType, setProposeType] = useState<'edit_goal' | 'edit_lock' | null>(null);
  const [proposeGoal, setProposeGoal] = useState('');
  const [proposeLock, setProposeLock] = useState('');
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState('');

  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [deletingVault, setDeletingVault] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [proposalBusy, setProposalBusy] = useState<string | null>(null);
  const [proposalActionError, setProposalActionError] = useState('');
  const [proposalNeedsPin, setProposalNeedsPin] = useState(false);
  const [proposalPinInput, setProposalPinInput] = useState('');
  const [proposalPinError, setProposalPinError] = useState('');
  const [proposalUnlocking, setProposalUnlocking] = useState(false);
  const [pendingProposalExecution, setPendingProposalExecution] = useState<VaultProposalRow | null>(null);

  useEffect(() => {
    if (!highlighted) return;

    const timeoutId = window.setTimeout(() => {
      setShowHighlight(false);
    }, 2500);

    return () => window.clearTimeout(timeoutId);
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
      await fn(amount, vault.onChainVaultId, vault.id, {
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
      await createAppNotification({
        message: 'Distribution transaction submitted to the blockchain.',
        vaultId: vault.id,
        variant: 'info',
        meta: { event: 'transaction_submitted', operation: 'distribute', timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      const hash = await submitSignedXDR(signedXdr);
      await pollTransaction(hash);

      const eventRes = await authFetch(`/api/vaults/${vault.id}/events`,{
        method: 'POST',
        body: JSON.stringify({
          eventType: 'distribution_completed',
          totalAmount: vault.balance,
        }),
      });
      const eventData = await eventRes.json().catch(() => null);
      if (!eventRes.ok) {
        throw new Error(eventData?.error ?? 'Vault balance sync failed after distribution');
      }
      
      await createAppNotification({
        message: 'Distribution transaction confirmed on-chain.',
        vaultId: vault.id,
        variant: 'success',
        meta: { event: 'transaction_confirmed', operation: 'distribute', hash, timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Distribution failed';
      await createAppNotification({
        message: `Distribution failed: ${message}`,
        vaultId: vault.id,
        variant: 'error',
        meta: { event: 'transaction_failed', operation: 'distribute', error: message, timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      setDistributeError(message);
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

  // ---------- Manage section handlers ----------

  const loadManageData = useCallback(async () => {
    setManageLoading(true);
    setManageError('');
    try {
      const [membersRes, proposalsRes] = await Promise.all([
        authFetch(`/api/vaults/${vault.id}/members`),
        authFetch(`/api/vaults/${vault.id}/proposals`),
      ]);
      const membersData = await membersRes.json();
      const proposalsData = await proposalsRes.json();
      if (!membersRes.ok) throw new Error(membersData?.error ?? 'Failed to load members');
      if (!proposalsRes.ok) throw new Error(proposalsData?.error ?? 'Failed to load proposals');
      setMembers(membersData);
      setProposals(proposalsData);
    } catch (e: unknown) {
      setManageError(e instanceof Error ? e.message : 'Failed to load vault management data');
    } finally {
      setManageLoading(false);
    }
  }, [vault.id]);

  const toggleManage = () => {
    const next = !showManage;
    setShowManage(next);
    if (next) void loadManageData();
  };

  const handleLeave = async () => {
    if (!publicKey) return;
    setLeaving(true);
    setLeaveError('');
    try {
      const xdr = await buildRemoveMemberXDR(publicKey, vault.onChainVaultId, publicKey);
      const signedXdr = await signWithCurrentAccount(xdr);
      const hash = await submitSignedXDR(signedXdr);
      await pollTransaction(hash);

      const res = await authFetch(`/api/vaults/${vault.id}/leave`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to leave vault');

      onChanged();
    } catch (e: unknown) {
      setLeaveError(e instanceof Error ? e.message : 'Failed to leave vault');
    } finally {
      setLeaving(false);
    }
  };

  const handleDeletePersonalVault = async () => {
    if (!publicKey) return;
    setDeletingVault(true);
    setDeleteError('');
    try {
      const xdr = await buildCloseVaultXDR(publicKey, vault.onChainVaultId);
      const signedXdr = await signWithCurrentAccount(xdr);
      const hash = await submitSignedXDR(signedXdr);
      await pollTransaction(hash);

      const res = await authFetch(`/api/vaults/${vault.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to delete vault');
      onChanged();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete vault');
    } finally {
      setDeletingVault(false);
    }
  };

  const handleProposeSubmit = async () => {
    if (!proposeType) return;
    setProposing(true);
    setProposeError('');
    try {
      const changes =
        proposeType === 'edit_goal'
          ? { targetAmount: Number(proposeGoal) }
          : { lockUntil: proposeLock };

      const res = await authFetch(`/api/vaults/${vault.id}/proposals`, {
        method: 'POST',
        body: JSON.stringify({ type: proposeType, changes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to create proposal');

      setProposeType(null);
      setProposeGoal('');
      setProposeLock('');
      await loadManageData();
    } catch (e: unknown) {
      setProposeError(e instanceof Error ? e.message : 'Failed to create proposal');
    } finally {
      setProposing(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    setProposalBusy(proposalId);
    setProposalActionError('');
    try {
      const res = await authFetch(`/api/vaults/${vault.id}/proposals/${proposalId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to approve proposal');
      await loadManageData();
    } catch (e: unknown) {
      setProposalActionError(e instanceof Error ? e.message : 'Failed to approve proposal');
    } finally {
      setProposalBusy(null);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    setProposalBusy(proposalId);
    setProposalActionError('');
    try {
      const res = await authFetch(`/api/vaults/${vault.id}/proposals/${proposalId}/reject`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to reject proposal');
      await loadManageData();
    } catch (e: unknown) {
      setProposalActionError(e instanceof Error ? e.message : 'Failed to reject proposal');
    } finally {
      setProposalBusy(null);
    }
  };

  const handleExecuteProposal = async (proposal: VaultProposalRow) => {
    setProposalBusy(proposal.id);
    setProposalActionError('');
    try {
      if (proposal.type === 'edit_goal' && proposal.changes?.targetAmount) {
        const xdr = await buildUpdateGoalXDR(vault.ownerPubkey, vault.onChainVaultId, proposal.changes.targetAmount);
        const signedXdr = await signWithCurrentAccount(xdr);
        const hash = await submitSignedXDR(signedXdr);
        await pollTransaction(hash);
      } else if (proposal.type === 'edit_lock' && proposal.changes?.lockUntil) {
        const lockTimestamp = Math.floor(new Date(proposal.changes.lockUntil).getTime() / 1000);
        const xdr = await buildUpdateLockXDR(vault.ownerPubkey, vault.onChainVaultId, lockTimestamp);
        const signedXdr = await signWithCurrentAccount(xdr);
        const hash = await submitSignedXDR(signedXdr);
        await pollTransaction(hash);
      }
      // type === 'delete' assumes balance is already 0 (distributed) before reaching here.

      const res = await authFetch(`/api/vaults/${vault.id}/proposals/${proposal.id}/execute`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to execute proposal');

      await loadManageData();
      onChanged();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to execute proposal';
      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setPendingProposalExecution(proposal);
        setProposalNeedsPin(true);
        setProposalBusy(null);
        return;
      }
      setProposalActionError(message);
    } finally {
      setProposalBusy(null);
    }
  };

  const handleProposalUnlockAndRetry = async () => {
    setProposalUnlocking(true);
    setProposalPinError('');
    try {
      await walletService.unlockPinAccount(proposalPinInput);
      setProposalNeedsPin(false);
      setProposalPinInput('');
      if (pendingProposalExecution) {
        const proposal = pendingProposalExecution;
        setPendingProposalExecution(null);
        await handleExecuteProposal(proposal);
      }
    } catch (e: unknown) {
      setProposalPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setProposalUnlocking(false);
    }
  };

  const withdrawDisabled = vault.vaultType !== 'Personal' || !vault.withdrawable;
  const isMemberOnly = !isOwned && vault.vaultType === 'Collaborative';
  const pendingProposal = proposals.find((p) => p.status === 'pending' || p.status === 'approved');

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

      {/* ---------- MANAGE SECTION ---------- */}
      <div className="pt-1 border-t border-slate-100 mt-1">
        <button
          onClick={toggleManage}
          className="w-full py-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors mt-2"
        >
          {showManage ? 'Hide Manage' : 'Manage Vault'}
        </button>

        {showManage && (
          <div className="mt-3 space-y-4">
            {manageLoading ? (
              <p className="text-[11px] text-slate-400 text-center py-2">Loading…</p>
            ) : manageError ? (
              <p className="text-[10px] text-rose-500">{manageError}</p>
            ) : (
              <>
                {/* Members list */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Members</p>
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 text-[11px]">
                        <span className="font-mono text-slate-600 truncate">{m.pubkey}</span>
                        <span className="text-[9px] uppercase tracking-wide text-slate-400">{m.role}</span>
                      </div>
                    ))}
                    {members.length === 0 && (
                      <p className="px-3 py-2 text-[11px] text-slate-400">No members found.</p>
                    )}
                  </div>
                </div>

                {/* Pending / approved proposal display */}
                {pendingProposal && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        {pendingProposal.type.replace('_', ' ')} proposal
                      </span>
                      <span className={`text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        pendingProposal.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {pendingProposal.status}
                      </span>
                    </div>
                    {pendingProposal.changes?.targetAmount && (
                      <p className="text-[11px] text-slate-500">New goal: {pendingProposal.changes.targetAmount} USDC</p>
                    )}
                    {pendingProposal.changes?.lockUntil && (
                      <p className="text-[11px] text-slate-500">New unlock date: {new Date(pendingProposal.changes.lockUntil).toLocaleDateString()}</p>
                    )}

                    {proposalActionError && <p className="text-[10px] text-rose-500">{proposalActionError}</p>}

                    {proposalNeedsPin && (
                      <div className="rounded-lg border border-slate-100 bg-white p-3 space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-light">
                          Enter PIN to continue
                        </p>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={proposalPinInput}
                          onChange={(e) => setProposalPinInput(e.target.value)}
                         placeholder="••••"
                          disabled={proposalUnlocking}
                          className="w-full rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs outline-none focus:border-[#A0F0F0] disabled:opacity-50"
                        />
                       {proposalPinError && <p className="text-[9px] text-rose-500">{proposalPinError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={handleProposalUnlockAndRetry}
                            disabled={proposalUnlocking || !proposalPinInput}
                            className="flex-1 py-2 rounded-lg bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-wider font-normal disabled:opacity-40"
                          >
                            {proposalUnlocking ? 'Unlocking…' : 'Unlock & continue'}
                          </button>
                          <button
                            onClick={() => { setProposalNeedsPin(false); setProposalPinInput(''); setProposalPinError(''); setPendingProposalExecution(null); }}
                            disabled={proposalUnlocking}
                            className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] uppercase tracking-wide text-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {pendingProposal.status === 'pending' && !isOwned && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleApproveProposal(pendingProposal.id)}
                          disabled={proposalBusy === pendingProposal.id}
                          className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-semibold disabled:opacity-50"
                        >
                          {proposalBusy === pendingProposal.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectProposal(pendingProposal.id)}
                          disabled={proposalBusy === pendingProposal.id}
                          className="flex-1 py-2 rounded-lg bg-rose-50 text-rose-600 text-[10px] uppercase tracking-wider font-semibold disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {pendingProposal.status === 'approved' && isOwned && (
                      <button
                        onClick={() => handleExecuteProposal(pendingProposal)}
                        disabled={proposalBusy === pendingProposal.id || proposalNeedsPin}
                        className="w-full py-2 rounded-lg bg-[#FF9F1C] text-white text-[10px] uppercase tracking-wider font-semibold disabled:opacity-50"
                      >
                        {proposalBusy === pendingProposal.id ? 'Executing…' : 'Execute Approved Change'}
                      </button>
                    )}
                  </div>
                )}

                {/* Owner: propose edit / delete */}
                {isOwned && vault.vaultType === 'Collaborative' && !pendingProposal && (
                  <div className="space-y-2">
                    {proposeType === null ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setProposeType('edit_goal')}
                          className="py-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 font-semibold"
                        >
                          Propose New Goal
                        </button>
                        <button
                          onClick={() => setProposeType('edit_lock')}
                          className="py-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 font-semibold"
                        >
                          Propose New Lock Date
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-100 p-3 space-y-2">
                        {proposeType === 'edit_goal' ? (
                          <input
                            type="number"
                            value={proposeGoal}
                            onChange={(e) => setProposeGoal(e.target.value)}
                            placeholder="New goal amount (USDC)"
                            className="w-full rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs outline-none focus:border-[#A0F0F0]"
                          />
                        ) : (
                          <input
                            type="date"
                            value={proposeLock}
                            onChange={(e) => setProposeLock(e.target.value)}
                            className="w-full rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs outline-none focus:border-[#A0F0F0]"
                          />
                        )}
                        {proposeError && <p className="text-[10px] text-rose-500">{proposeError}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={handleProposeSubmit}
                            disabled={proposing || (proposeType === 'edit_goal' ? !proposeGoal : !proposeLock)}
                            className="flex-1 py-2 rounded-lg bg-[#FF9F1C] text-white text-[10px] uppercase tracking-wider font-semibold disabled:opacity-50"
                          >
                            {proposing ? 'Submitting…' : 'Submit Proposal'}
                          </button>
                          <button
                            onClick={() => { setProposeType(null); setProposeGoal(''); setProposeLock(''); setProposeError(''); }}
                            disabled={proposing}
                            className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] uppercase tracking-wide text-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Leave (non-owner collaborative member) */}
                {isMemberOnly && (
                  <div className="space-y-1.5">
                    {leaveError && <p className="text-[10px] text-rose-500">{leaveError}</p>}
                    <button
                      onClick={handleLeave}
                      disabled={leaving}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50"
                    >
                      {leaving ? 'Leaving…' : 'Leave Vault'}
                    </button>
                  </div>
                )}

                {/* Delete (owner, personal vault) */}
                {isOwned && vault.vaultType === 'Personal' && (
                  <div className="space-y-1.5">
                    {deleteError && <p className="text-[10px] text-rose-500">{deleteError}</p>}
                    {vault.status === 'Closed' ? (
                      <p className="text-[10px] text-slate-400 text-center py-2">This vault has been closed.</p>
                    ) : (
                    <button
                      onClick={handleDeletePersonalVault}
                      disabled={deletingVault || vault.balance !== 0}
                      title={vault.balance !== 0 ? 'Withdraw all funds before deleting' : undefined}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    >
                      {deletingVault ? 'Deleting…' : 'Delete Vault'}
                    </button>
                    )}
                  </div>
                )}

                {/* Delete (owner, collaborative vault — via proposal) */}
                {isOwned && vault.vaultType === 'Collaborative' && !pendingProposal && (
                  <div className="space-y-1.5">
                    {proposeError && <p className="text-[10px] text-rose-500">{proposeError}</p>}
                    <button
                      onClick={async () => {
                        setProposing(true);
                        setProposeError('');
                        try {
                          const res = await authFetch(`/api/vaults/${vault.id}/proposals`, {
                            method: 'POST',
                            body: JSON.stringify({ type: 'delete' }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error ?? 'Failed to propose deletion');
                          await loadManageData();
                        } catch (e: unknown) {
                          setProposeError(e instanceof Error ? e.message : 'Failed to propose deletion');
                        } finally {
                          setProposing(false);
                        }
                      }}
                      disabled={proposing || vault.balance !== 0}
                      title={vault.balance !== 0 ? 'Distribute all funds before proposing deletion' : undefined}
                      className="w-full py-2.5 rounded-xl bg-rose-50 text-rose-600 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    >
                      {proposing ? 'Proposing…' : 'Propose Vault Deletion'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
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
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusVaultId || (owned.length === 0 && joined.length === 0)) return;

    const inOwned = owned.some((v) => v.id === focusVaultId);
    const inJoined = joined.some((v) => v.id === focusVaultId);

    if (!inOwned && !inJoined) {
      onFocusHandled?.();
      return;
    }

    window.setTimeout(() => {
      setSubTab(inOwned ? 'owned' : 'joined');
    }, 0);

    const timeout = window.setTimeout(() => {
      const el = cardRefs.current.get(focusVaultId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled?.();
    }, 50);

    return () => window.clearTimeout(timeout);
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
                  ? 'text-orange-500'
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
                    publicKey={publicKey}
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
