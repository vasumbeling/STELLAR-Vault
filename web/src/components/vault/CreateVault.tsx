'use client';

import { useState } from 'react';
import { buildCreateVaultXDR } from '@/lib/contract';
import { submitSignedXDR, pollTransactionForResult } from '@/lib/payment';
import { CONTRACT_ID } from '@/lib/stellar';
import { authFetch, signWithCurrentAccount, walletService } from '@/lib/wallet';
import { createAppNotification } from '@/lib/notifications';

type Status = 'idle' | 'building' | 'signing' | 'submitting' | 'confirming' | 'saving' | 'success' | 'error';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Create Vault',
  building: 'Building…',
  signing: 'Signing…',
  submitting: 'Submitting…',
  confirming: 'Verifying…',
  saving: 'Saving…',
  success: 'Vault created!',
  error: 'Create Vault',
};

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
      await createAppNotification({
        message: 'Vault creation transaction submitted to the blockchain.',
        variant: 'info',
        meta: { event: 'transaction_submitted', operation: 'create_vault', timestamp: new Date().toISOString() },
      }).catch(() => undefined);
      const hash = await submitSignedXDR(signedXdr);

      setStatus('confirming');
      const onChainVaultId = await pollTransactionForResult(hash);
      await createAppNotification({
        message: 'Vault creation transaction confirmed on-chain.',
        variant: 'success',
        meta: { event: 'transaction_confirmed', operation: 'create_vault', hash, timestamp: new Date().toISOString() },
      }).catch(() => undefined);
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

      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setNeedsPin(true);
        setStatus('idle');
        return;
      }

      await createAppNotification({
        message: `Vault creation failed: ${message}`,
        variant: 'error',
        meta: { event: 'transaction_failed', operation: 'create_vault', error: message, timestamp: new Date().toISOString() },
      }).catch(() => undefined);
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
      await runCreateVault();
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="bg-white p-5 text-[#1A1A1A] font-mono tracking-tight space-y-4 animate-fadeIn">
      <div className="space-y-1">
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Vault Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency Fund"
          disabled={busy}
          className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors placeholder:text-slate-300"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Description (Optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          disabled={busy}
          className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors placeholder:text-slate-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Vault Type</label>
          <select
            value={vaultType}
            onChange={(e) => setVaultType(e.target.value as 'Personal' | 'Collaborative')}
            disabled={busy}
            className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 text-xs font-light text-slate-600 outline-none focus:border-[#A0F0F0] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <option value="Personal">Personal</option>
            <option value="Collaborative">Collaborative</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Target Amount</label>
          <div className="relative flex items-center">
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-3.5 pr-12 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors"
            />
            <span className="absolute right-3.5 text-[10px] text-slate-400">USDC</span>
          </div>
        </div>
      </div>

      {!needsPin && (
        <button
          onClick={runCreateVault}
          disabled={busy || !name.trim() || Number(targetAmount) <= 0}
          className="w-full py-3 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest hover:opacity-95 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2 font-normal"
        >
          {busy && (
            <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <span>{STATUS_LABEL[status]}</span>
        </button>
      )}

      {needsPin && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-light">
            Enter PIN
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
              {unlocking ? 'Creating…' : 'Create Vault'}
            </button>
            <button
              onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
              disabled={unlocking}
              className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[10px] uppercase tracking-wide text-slate-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="p-3 text-[11px] text-emerald-600 font-light">
          <p>Vault created successfully.</p>
        </div>
      )}

      {error && (
        <div className="p-3 text-[11px] text-rose-500 font-light">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}