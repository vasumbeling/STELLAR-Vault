'use client';
import { useState } from 'react';
import { buildCreateVaultXDR } from '@/lib/contract';
import { submitSignedXDR, pollTransactionForResult } from '@/lib/payment';
import { CONTRACT_ID } from '@/lib/stellar';
import { authFetch, signWithCurrentAccount, walletService } from '@/lib/wallet';

type Status = 'idle' | 'building' | 'signing' | 'submitting' | 'confirming' | 'saving' | 'success' | 'error';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Create Vault',
  building: 'Building transaction…',
  signing: 'Waiting for signature…',
  submitting: 'Submitting to network…',
  confirming: 'Confirming on-chain…',
  saving: 'Saving vault…',
  success: 'Vault created!',
  error: 'Create Vault',
};

// Matches the exact message thrown by signWithCurrentAccount when the
// in-memory secret key isn't available (e.g. after a page reload).
const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function CreateVault({
  publicKey,
  onCreated,
}: {
  publicKey: string;
  onCreated: (vaultId: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState('Emergency Fund');
  const [vaultType, setVaultType] = useState<'Personal' | 'Collaborative'>('Personal');
  const [targetAmount, setTargetAmount] = useState('500');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  // Re-auth prompt state — shown only if signing fails because the
  // in-memory session key was cleared (e.g. after a reload).
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const busy = !['idle', 'success', 'error'].includes(status);

  const runCreateVault = async () => {
    setStatus('building');
    setError('');
    try {
      const xdr = await buildCreateVaultXDR({
        creator: publicKey,
        purpose: name.trim(),
        vaultType,
        goalAmount: Number(targetAmount),
      });

      setStatus('signing');
      const signedXdr = await signWithCurrentAccount(xdr);

      setStatus('submitting');
      const hash = await submitSignedXDR(signedXdr);

      setStatus('confirming');
      const onChainVaultId = await pollTransactionForResult(hash);
      if (onChainVaultId === undefined || onChainVaultId === null) {
        throw new Error('Vault was created on-chain, but no vault ID was returned.');
      }

      setStatus('saving');
      const res = await authFetch('/api/vaults', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          goalType,
          targetAmount: Number(targetAmount),
          contractAddress: CONTRACT_ID,
          onChainVaultId: String(onChainVaultId),
          vaultType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Vault created on-chain, but saving to the backend failed.');
      }

      setStatus('success');
      onCreated(data.id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Vault creation failed';

      // Instead of showing a dead-end error, offer an inline PIN re-entry
      // so the user can pick up right where they left off.
      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setNeedsPin(true);
        setStatus('idle');
        return;
      }

      setError(message);
      setStatus('error');
    }
  };

  const handleUnlockAndRetry = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      await walletService.unlockPinAccount(pinInput);
      setNeedsPin(false);
      setPinInput('');
      await runCreateVault(); // retry automatically now that the key is back
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="rounded-4xl border border-violet-100/40 bg-white p-6 shadow-xl shadow-indigo-900/5 space-y-4">
      <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">Create a Vault</h2>

      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vault name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency Fund"
          disabled={busy}
          className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-200 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-200 disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</label>
          <select
            value={vaultType}
            onChange={(e) => setVaultType(e.target.value as 'Personal' | 'Collaborative')}
            disabled={busy}
            className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-violet-200 disabled:opacity-50"
          >
            <option value="Personal">Personal</option>
            <option value="Collaborative">Collaborative</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Target (USDC)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-200 disabled:opacity-50"
          />
        </div>
      </div>

      {!needsPin && (
        <button
          onClick={runCreateVault}
          disabled={busy || !name.trim() || Number(targetAmount) <= 0}
          className="w-full rounded-xl bg-[#6C5DD3] py-3 text-xs font-bold text-white shadow-md shadow-indigo-900/10 hover:bg-[#5B4FBF] transition-all disabled:opacity-40 active:scale-[0.98]"
        >
          {STATUS_LABEL[status]}
        </button>
      )}

      {needsPin && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-700">
            Your session timed out. Enter your PIN to continue creating this vault.
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Enter PIN"
            disabled={unlocking}
            className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-300 disabled:opacity-50"
          />
          {pinError && <p className="text-[11px] font-bold text-rose-600">{pinError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleUnlockAndRetry}
              disabled={unlocking || !pinInput}
              className="flex-1 rounded-xl bg-[#6C5DD3] py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {unlocking ? 'Unlocking…' : 'Unlock & Continue'}
            </button>
            <button
              onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
              disabled={unlocking}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="text-xs font-bold text-emerald-800">Vault created and saved successfully.</p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
          <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
        </div>
      )}
    </div>
  );
}