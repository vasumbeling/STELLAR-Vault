'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchVaultInvitations, confirmInvitation, type Invitation } from '@/lib/invitations';
import { buildAddMemberXDR, readListMembers } from '@/lib/contract';
import { signWithCurrentAccount, walletService } from '@/lib/wallet';
import { submitSignedXDR, pollTransaction } from '@/lib/payment';
import { createAppNotification } from '@/lib/notifications';

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function PendingConfirmations({
  vaultId,
  onChainVaultId,
  ownerPubkey,
  onConfirmed,
}: {
  vaultId: string;
  onChainVaultId: string;
  ownerPubkey: string;
  onConfirmed: () => void;
}) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [pendingInvitation, setPendingInvitation] = useState<Invitation | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await fetchVaultInvitations(vaultId);
      setInvites(all.filter((i) => i.status === 'accepted'));
    } catch {
      // silent — non-critical list
    }
  }, [vaultId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const confirm = async (invitation: Invitation) => {
    setBusyId(invitation.id);
    setError('');
    try {
      const members = await readListMembers(onChainVaultId);
      const shareBps = Math.floor(10_000 / (members.length + 1));

      const xdr = await buildAddMemberXDR(ownerPubkey, onChainVaultId, invitation.inviteePubkey, shareBps);
      const signedXdr = await signWithCurrentAccount(xdr);
      await createAppNotification({
        message: 'Member addition transaction submitted to the blockchain.',
        vaultId,
        variant: 'info',
        meta: { event: 'transaction_submitted', operation: 'add_member', timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      const hash = await submitSignedXDR(signedXdr);
      await pollTransaction(hash);
      await createAppNotification({
        message: 'Member addition transaction confirmed on-chain.',
        vaultId,
        variant: 'success',
        meta: { event: 'transaction_confirmed', operation: 'add_member', hash, timestamp: new Date().toISOString() },
      }).catch(() => undefined);

      await confirmInvitation(invitation.id);
      await refresh();
      onConfirmed();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to confirm member';
      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setPendingInvitation(invitation);
        setNeedsPin(true);
        setBusyId(null);
        return;
      }
      await createAppNotification({
        message: `Member addition failed: ${message}`,
        vaultId,
        variant: 'error',
        meta: { event: 'transaction_failed', operation: 'add_member', error: message, timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      setError(message);
    } finally {
      setBusyId(null);
    }
  };

  const handleUnlockAndRetry = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      await walletService.unlockPinAccount(pinInput);
      setNeedsPin(false);
      setPinInput('');
      if (pendingInvitation) {
        const invitation = pendingInvitation;
        setPendingInvitation(null);
        await confirm(invitation);
      }
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  if (invites.length === 0 && !needsPin) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-slate-100 mt-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-light">Awaiting your confirmation</p>
      {error && <p className="text-[10px] text-rose-500">{error}</p>}

      {needsPin && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
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
              onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); setPendingInvitation(null); }}
              disabled={unlocking}
              className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {invites.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2">
          <span className="text-[10px] font-mono text-slate-500 truncate">{inv.inviteePubkey}</span>
          <button
            onClick={() => confirm(inv)}
            disabled={busyId === inv.id || needsPin}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-[#FF9F1C] text-white text-[9px] font-semibold uppercase tracking-wider disabled:opacity-50"
          >
            {busyId === inv.id ? 'Confirming…' : 'Add to vault'}
          </button>
        </div>
      ))}
    </div>
  );
}