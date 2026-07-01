'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  contractConfigured,
  readSavingsState,
  type SavingsState,
} from '@/lib/contract';
import {
  depositUSDC,
  withdrawUSDC,
  transferUSDC,
  getTransferState,
  subscribeToTransferState,
  resetTransferState,
  createPendingTransferApproval,
  getPendingTransferApprovalsForAddress,
  updatePendingTransferApproval,
  removePendingTransferApproval,
  type PendingTransferApproval,
} from '@/lib/transfer';

interface DashboardProps {
  publicKey: string | null;
}

export default function SavingsDashboard({ publicKey }: DashboardProps) {
  const configured = contractConfigured();
  const [state, setState] = useState<SavingsState | null>(null);
  const [phpRate, setPhpRate] = useState<number>(58.60);
  const [loading, setLoading] = useState<boolean>(configured);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [approvalVersion, setApprovalVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [transferState, setTransferState] = useState(getTransferState());

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError('');
    try {
      setState(await readSavingsState());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to read contract');
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (configured) {
      (async () => {
        await refresh();
      })();
    }
  }, [configured, refresh]);

  useEffect(() => {
    return subscribeToTransferState(() => {
      setTransferState(getTransferState());
    });
  }, []);

  const pendingApproval = useMemo<PendingTransferApproval | null>(() => {
    if (!publicKey) {
      return null;
    }

    return getPendingTransferApprovalsForAddress(publicKey).find((item) => item.status !== 'submitted') ?? null;
  }, [publicKey, approvalVersion]);

  useEffect(() => {
    // Fetch live exchange rate
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => res.json())
      .then((data) => {
        if (data?.rates?.PHP) {
          setPhpRate(data.rates.PHP);
        }
      })
      .catch(() => {});
  }, []);

  const handleDeposit = async () => {
    if (!publicKey || !depositAmount) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await depositUSDC(depositAmount, {
        onCompleted: async () => {
          setDepositAmount('');
          await refresh();
        },
      });
      setMsg('Contribution saved successfully!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Contribution failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await withdrawUSDC(withdrawAmount, {
        onCompleted: async () => {
          setWithdrawAmount('');
          await refresh();
        },
      });
      setMsg('Withdrawal completed successfully!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleTransferRequest = () => {
    if (!publicKey || !recipient || !transferAmount) return;

    const pending = createPendingTransferApproval(publicKey, recipient, Number(transferAmount));
    setApprovalVersion((value) => value + 1);
    setMsg('Transfer request created. The receiver must approve it before it can be sent.');
    setError('');
    void pending;
  };

  const handleApproveAsSender = () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey) return;

    const updated = updatePendingTransferApproval(pendingApproval.id, { senderAuthorized: true });
    if (updated) {
      setApprovalVersion((value) => value + 1);
      setMsg('Sender approval recorded. Waiting for receiver approval.');
    }
  };

  const handleApproveAsReceiver = () => {
    if (!pendingApproval || !publicKey || pendingApproval.recipient !== publicKey) return;

    const updated = updatePendingTransferApproval(pendingApproval.id, { receiverAuthorized: true });
    if (updated) {
      setApprovalVersion((value) => value + 1);
      setMsg('Receiver approval recorded. The sender can now submit the transfer.');
    }
  };

  const handleSubmitApprovedTransfer = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey || !pendingApproval.senderAuthorized || !pendingApproval.receiverAuthorized) return;

    setBusy(true);
    setError('');
    setMsg('');
    try {
      await transferUSDC(pendingApproval.recipient, pendingApproval.amount, {
        onCompleted: async () => {
          setRecipient('');
          setTransferAmount('');
          removePendingTransferApproval(pendingApproval.id);
          setApprovalVersion((value) => value + 1);
        },
      });
      setMsg('USDC transfer completed successfully!');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  if (!configured) {
    return (
      <div className="p-6 max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl text-white shadow-xl">
        <p className="text-sm text-slate-400">Contract not configured. Deploy first.</p>
      </div>
    );
  }

  const usdcBalance = state?.saved || 0;
  const totalEquivalentInPhp = usdcBalance * phpRate;
  const purchasingPowerSaved = usdcBalance * (phpRate * 0.06);

  return (
    <div className="p-6 max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl text-white shadow-xl space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Peso Inflation Shield 🇵🇭</h2>
          <p className="text-xs text-slate-400 mt-1">Soroban-Secured USDC Vault</p>
        </div>
        <span className="bg-blue-500/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded border border-blue-500/20 uppercase tracking-wider">
          Active
        </span>
      </div>

      {/* Primary Balance Interface */}
      <div className="bg-linear-to-br from-indigo-600 to-blue-700 p-5 rounded-xl shadow-inner">
        <span className="text-xs text-blue-200 uppercase tracking-wider block font-semibold">Protected Asset Balance</span>
        {loading ? (
          <span className="text-2xl font-extrabold mt-1 block text-blue-200">Loading...</span>
        ) : (
          <>
            <span className="text-4xl font-extrabold mt-1 block tracking-tight">${usdcBalance.toFixed(2)} <span className="text-lg font-medium text-blue-200">USDC</span></span>
            <div className="mt-4 pt-3 border-t border-blue-500/30 flex justify-between text-sm text-blue-100">
              <span>Current Cash Value:</span>
              <span className="font-bold">₱{totalEquivalentInPhp.toLocaleString(undefined, {maximumFractionDigits: 2})} PHP</span>
            </div>
          </>
        )}
      </div>

      {/* Protection Insights Widget */}
      <div className="bg-slate-800/40 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Live Forex Index Rate:</span>
          <span className="text-emerald-400 font-mono font-medium">1 USD = ₱{phpRate.toFixed(2)} PHP</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Purchasing Power Defended:</span>
          <span className="text-emerald-400 font-semibold">+₱{purchasingPowerSaved.toFixed(2)} Saved from Inflation</span>
        </div>
      </div>

      {/* Deposit / Withdraw Input Section */}
      {publicKey && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide block font-semibold">
              Amount to Deposit (USDC)
            </label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              disabled={busy}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide block font-semibold">
              Amount to Withdraw (USDC)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="0.00"
              disabled={busy}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          {transferState.status !== 'idle' && (
            <p className="text-xs text-slate-300">{transferState.message}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {msg && <p className="text-xs text-green-400">{msg}</p>}
        </div>
      )}

      {/* Direct Transfer Section */}
      {publicKey && (
        <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Send USDC to another wallet</p>
            <p className="mt-1 text-[11px] text-slate-500">This transfer requires explicit sender and receiver approval before it is submitted.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide block font-semibold">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="GB..."
              disabled={busy}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide block font-semibold">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.00"
              disabled={busy}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>

          {!pendingApproval && (
            <button
              onClick={handleTransferRequest}
              disabled={!publicKey || !recipient || !transferAmount || busy || loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/10 active:scale-[0.98]"
            >
              {busy ? 'Processing...' : 'Start Approval Flow'}
            </button>
          )}

          {pendingApproval && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-300 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">Approval status</span>
                <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400">
                  {pendingApproval.status}
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-400">
                <p>Sender: {pendingApproval.sender.slice(0, 8)}…{pendingApproval.sender.slice(-4)}</p>
                <p>Recipient: {pendingApproval.recipient.slice(0, 8)}…{pendingApproval.recipient.slice(-4)}</p>
                <p>Amount: {pendingApproval.amount.toFixed(7)} USDC</p>
              </div>
              <div className="flex flex-col gap-2">
                {publicKey === pendingApproval.sender && !pendingApproval.senderAuthorized && (
                  <button
                    onClick={handleApproveAsSender}
                    disabled={busy}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Approve as sender
                  </button>
                )}
                {publicKey === pendingApproval.recipient && !pendingApproval.receiverAuthorized && (
                  <button
                    onClick={handleApproveAsReceiver}
                    disabled={busy}
                    className="w-full rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve as receiver
                  </button>
                )}
                {pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && publicKey === pendingApproval.sender && (
                  <button
                    onClick={handleSubmitApprovedTransfer}
                    disabled={busy}
                    className="w-full rounded-lg bg-purple-600 px-3 py-2 font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    Submit transfer
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Triggers */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={handleWithdraw}
          disabled={!publicKey || !withdrawAmount || busy || loading}
          className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-sm font-semibold py-3 rounded-xl transition-all active:scale-[0.98]">
          {busy ? 'Processing...' : 'Withdraw'}
        </button>
        <button
          onClick={handleDeposit}
          disabled={!publicKey || !depositAmount || busy || loading}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]">
          {busy ? 'Processing...' : 'Convert & Save'}
        </button>
      </div>

      <button
        onClick={refresh}
        disabled={loading}
        className="w-full text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50"
      >
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  );
}