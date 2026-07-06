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
      await runCreateVault();
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="rounded-4xl bg-white p-6 shadow-sm border border-[#e4beb1]/30 space-y-4 text-[#1e1b18]">
      <h2 className="text-sm font-black text-[#a73a00] tracking-tight uppercase">Create a Vault</h2>

      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">Vault Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency Fund"
          disabled={busy}
          className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 px-3.5 py-2.5 text-sm text-[#1e1b18] outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors placeholder:text-[#5b4137]/30"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">Description (optional)</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What are you saving for?"
          disabled={busy}
          className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 px-3.5 py-2.5 text-sm text-[#1e1b18] outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors placeholder:text-[#5b4137]/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">Type</label>
          <select
            value={vaultType}
            onChange={(e) => setVaultType(e.target.value as 'Personal' | 'Collaborative')}
            disabled={busy}
            className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 px-3.5 py-2.5 text-xs font-bold text-[#5b4137] outline-none focus:border-[#a73a00] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <option value="Personal">Personal</option>
            <option value="Collaborative">Collaborative</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">Target (USDC)</label>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            disabled={busy}
            className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 px-3.5 py-2.5 text-sm text-[#1e1b18] outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors"
          />
        </div>
      </div>

      {!needsPin && (
        <button
          onClick={runCreateVault}
          disabled={busy || !name.trim() || Number(targetAmount) <= 0}
          className="w-full rounded-xl bg-[#ff5c00] py-3 text-xs font-black text-white uppercase tracking-widest hover:bg-[#a73a00] transition-all disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
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
        <div className="rounded-xl border border-[#e4beb1]/60 bg-[#fff8f5] p-4 space-y-3">
          <p className="text-xs font-bold text-[#5b4137]">
            Your session timed out. Enter your PIN to continue creating this vault.
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Enter PIN"
            disabled={unlocking}
            className="w-full rounded-xl bg-white border border-[#e4beb1] px-3.5 py-2.5 text-sm text-[#1e1b18] outline-none focus:border-[#a73a00] disabled:opacity-50"
          />
          {pinError && <p className="text-[11px] font-bold text-rose-600">{pinError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleUnlockAndRetry}
              disabled={unlocking || !pinInput}
              className="flex-1 rounded-xl bg-[#9AFAFA] py-2.5 text-xs font-black uppercase tracking-widest text-[#0F4F53] disabled:opacity-40 hover:bg-[#7becec] transition-colors"
            >
              {unlocking ? 'Unlocking…' : 'Unlock'}
            </button>
            <button
              onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); }}
              disabled={unlocking}
              className="rounded-xl bg-[#e9e1dc] px-4 py-2.5 text-xs font-bold uppercase text-[#5b4137] disabled:opacity-40 hover:bg-[#dfd5ce] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <p className="text-xs font-bold text-emerald-700">Vault created and saved successfully.</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
        </div>
      )}
    </div>
  );
}