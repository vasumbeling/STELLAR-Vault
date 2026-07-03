'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchBalances, type Balances } from '@/lib/balances';
import {
  contractConfigured,
  readSavingsState,
  readVaultBalanceSummary,
  type SavingsState,
  type VaultBalanceSummary,
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
import { loadHistory, type HistoryEntry } from '@/lib/history';

interface DashboardProps {
  publicKey: string | null;
}

type Panel = 'deposit' | 'withdraw' | 'receive' | null;
type Tab = 'home' | 'send_tab' | 'activity' | 'profile';

/* ---------- Custom UI SVGs From Mockup Design ---------- */

function BellIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );
}

function EyeIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function SparkleStar({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2c0 4.2 1.2 7 3.2 9S22 12.8 22 12s-4.8-.8-6.8-2.8S12 2 12 2z" />
      <path d="M12 22c0-4.2-1.2-7-3.2-9S2 11.2 2 12s4.8.8 6.8 2.8S12 22 12 22z" />
    </svg>
  );
}

function ActionIcon({ type }: { type: 'deposit' | 'withdraw' | 'send' | 'receive' }) {
  if (type === 'deposit') {
    return (
      <svg className="w-6 h-6 text-[#6C5DD3]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
      </svg>
    );
  }
  if (type === 'withdraw') {
    return (
      <svg className="w-6 h-6 text-[#6C5DD3]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
      </svg>
    );
  }
  if (type === 'send') {
    return (
      <svg className="w-5 h-5 text-[#6C5DD3] transform rotate-[-15deg]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-[#6C5DD3]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1"></rect>
      <rect x="14" y="3" width="7" height="7" rx="1"></rect>
      <rect x="14" y="14" width="7" height="7" rx="1"></rect>
      <rect x="3" y="14" width="7" height="7" rx="1"></rect>
      <path d="M7 7h.01M17 7h.01M7 17h.01"></path>
    </svg>
  );
}

/* ---------- Bottom Navigation SVGs ---------- */
function NavIcon({ type, active }: { type: Tab; active: boolean }) {
  const color = active ? '#6C5DD3' : '#A0AEC0';
  if (type === 'home') {
    return (
      <svg className="w-6 h-6" fill={active ? color : 'none'} stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    );
  }
  if (type === 'send_tab') {
    return (
      <svg className="w-6 h-6 transform rotate-[-15deg]" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    );
  }
  if (type === 'activity') {
    return (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4"></circle>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    </svg>
  );
}

function entryVisual(kind: string) {
  switch (kind) {
    case 'withdraw':
      return { bg: 'bg-[#FFF7EE]', fg: 'text-[#B8792E]', icon: '↑' };
    case 'transfer':
      return { bg: 'bg-[#ECE9FF]', fg: 'text-[#6C5DD3]', icon: '➤' };
    default:
      return { bg: 'bg-[#E1F7EE]', fg: 'text-[#10B981]', icon: '↓' };
  }
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatAmount(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export default function SavingsDashboard({ publicKey }: DashboardProps) {
  const configured = contractConfigured();
  const [state, setState] = useState<SavingsState | null>(null);
  const [walletBalances, setWalletBalances] = useState<Balances | null>(null);
  const [vaultSummary, setVaultSummary] = useState<VaultBalanceSummary | null>(null);
  const [phpRate, setPhpRate] = useState<number>(58.60);
  const [loading, setLoading] = useState<boolean>(configured);
  const [vaultSummaryLoading, setVaultSummaryLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [transferState, setTransferState] = useState(getTransferState());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

  // Sliders, clamped to sensible boundaries, feed the real deposit/withdraw calls below.
  const [depositAmount, setDepositAmount] = useState('250');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const loadVaultSummary = useCallback(async (address: string | null = publicKey) => {
    const vaultId = process.env.NEXT_PUBLIC_VAULT_ID || process.env.NEXT_PUBLIC_CONTRACT_ID;
    if (!configured || !vaultId) {
      setVaultSummary(null);
      return;
    }

    setVaultSummaryLoading(true);
    try {
      setVaultSummary(await readVaultBalanceSummary(vaultId, address));
    } catch {
      setVaultSummary(null);
    } finally {
      setVaultSummaryLoading(false);
    }
  }, [configured, publicKey]);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError('');
    try {
      setState(await readSavingsState());
      await loadVaultSummary(publicKey);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to read contract');
    } finally {
      setLoading(false);
    }
  }, [configured, loadVaultSummary, publicKey]);

  const refreshHistory = useCallback(async (address: string | null) => {
    if (!address) {
      setHistory([]);
      return;
    }
    setHistory(await loadHistory(address));
  }, []);

  useEffect(() => {
    if (!configured) return;
    let ignore = false;

    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        setLoading(true);
        setError('');
        return readSavingsState();
      })
      .then((next) => {
        if (!ignore && next !== undefined) setState(next);
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : 'Failed to read contract');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [configured]);

  useEffect(() => {
    let ignore = false;

    Promise.resolve()
      .then(() => {
        if (ignore) return undefined;
        if (!publicKey) {
          setHistory([]);
          return undefined;
        }
        return loadHistory(publicKey);
      })
      .then((data) => {
        if (!ignore && data !== undefined) setHistory(data);
      });

    return () => {
      ignore = true;
    };
  }, [publicKey]);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!publicKey) {
        if (!ignore) {
          setWalletBalances(null);
        }
        return;
      }

      try {
        const balances = await fetchBalances(publicKey);
        if (!ignore) {
          setWalletBalances(balances);
        }
      } catch {
        if (!ignore) {
          setWalletBalances(null);
        }
      }
    };

    void run();

    return () => {
      ignore = true;
    };
  }, [publicKey]);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!publicKey) {
        if (!ignore) {
          setVaultSummary(null);
        }
        return;
      }

      if (!ignore) {
        await loadVaultSummary(publicKey);
      }
    };

    void run();

    return () => {
      ignore = true;
    };
  }, [loadVaultSummary, publicKey]);

  useEffect(() => {
    return subscribeToTransferState(() => {
      setTransferState(getTransferState());
    });
  }, []);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((res) => res.json())
      .then((data) => {
        if (data?.rates?.PHP) {
          setPhpRate(data.rates.PHP);
        }
      })
      .catch(() => {});
  }, []);

  const pendingApproval = useMemo<PendingTransferApproval | null>(() => {
    if (!publicKey) return null;
    return getPendingTransferApprovalsForAddress(publicKey).find((item) => item.status !== 'submitted') ?? null;
  }, [publicKey]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const identity = publicKey ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}` : 'Guest';

  const togglePanel = (next: Panel) => {
    setError('');
    setMsg('');
    setPanel((current) => (current === next ? null : next));
  };

  const handleCopyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available, ignore silently
    }
  };

  const handleDeposit = async () => {
    if (!publicKey || !depositAmount || Number(depositAmount) <= 0) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await depositUSDC(depositAmount, {
        onCompleted: async () => {
          await refresh();
          await refreshHistory(publicKey);
        },
      });
      setMsg('Contribution saved successfully!');
      setPanel(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Contribution failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await withdrawUSDC(withdrawAmount, {
        onCompleted: async () => {
          await refresh();
          await refreshHistory(publicKey);
        },
      });
      setMsg('Withdrawal completed successfully!');
      setPanel(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleTransferRequest = () => {
    if (!publicKey || !recipient || !transferAmount) return;
    createPendingTransferApproval(publicKey, recipient, Number(transferAmount));
    setMsg('Transfer request created. The receiver must approve it before it can be sent.');
    setError('');
  };

  const handleApproveAsSender = () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey) return;
    if (updatePendingTransferApproval(pendingApproval.id, { senderAuthorized: true })) {
      setMsg('Sender approval recorded. Waiting for receiver approval.');
    }
  };

  const handleApproveAsReceiver = () => {
    if (!pendingApproval || !publicKey || pendingApproval.recipient !== publicKey) return;
    if (updatePendingTransferApproval(pendingApproval.id, { receiverAuthorized: true })) {
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
          await refreshHistory(publicKey);
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
      <div className="p-6 max-w-md mx-auto bg-white border border-violet-100 rounded-3xl text-slate-800 shadow-xl flex items-center gap-3">
        <p className="text-sm font-medium text-slate-500">Deploy the Soroban tracking contract to access your assets.</p>
      </div>
    );
  }

  const walletUsdcBalance = safeNumber(walletBalances?.usdc);
  const walletXlmBalance = safeNumber(walletBalances?.xlm);
  const stateSaved = safeNumber(state?.saved);
  const stateTarget = safeNumber(state?.target);
  const usdcBalance = safeNumber(vaultSummary?.balance ?? stateSaved);
  const vaultGoal = Math.max(safeNumber(vaultSummary?.goalAmount ?? stateTarget), 1);
  const vaultProgress = safeNumber(vaultSummary?.progress) > 0
    ? Math.min(100, safeNumber(vaultSummary?.progress))
    : (stateTarget > 0 ? Math.min(100, (stateSaved / stateTarget) * 100) : 0);
  const vaultRemaining = Math.max(vaultGoal - usdcBalance, 0);
  const totalEquivalentInPhp = walletUsdcBalance * phpRate;
  const purchasingPowerSaved = walletUsdcBalance * (phpRate * 0.06);
  const recentPreview = history.slice(0, 3);

  return (
    <div className="max-w-md mx-auto min-h-230 bg-[#F9F8FE] rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col justify-between font-sans border border-slate-100/80">

      <div className="flex-1 pb-32 overflow-y-auto">

        {/* Dynamic Background Organic Curves */}
        <div className="absolute top-0 inset-x-0 h-80 bg-linear-to-b from-[#E7DCFC] via-[#F4EEFE] to-[#F9F8FE] -z-10 pointer-events-none opacity-80" />
        <div className="absolute top-10 -right-5 w-64 h-64 rounded-full bg-white/60 blur-3xl -z-10 pointer-events-none" />

        {/* Header Ribbon Bar */}
        <div className="px-6 pt-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#6C5DD3] rounded-full animate-pulse" />
            <span className="text-sm font-black tracking-widest uppercase text-[#4A3DA3] opacity-90">STELLA VAULT</span>
          </div>
          <div className="relative cursor-pointer p-2.5 bg-white/80 rounded-full border border-violet-100 shadow-sm active:scale-95 transition-all">
            <BellIcon className="w-5 h-5 text-slate-600" />
          </div>
        </div>

        {activeTab === 'home' && (
          <>
            {/* User Workspace Greeting */}
            <div className="px-6 mt-6">
              <p className="text-sm font-semibold text-slate-500">{greeting()},</p>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2 mt-0.5">
                {identity} <SparkleStar className="w-5 h-5 text-[#6C5DD3]" />
              </h2>
            </div>

            {/* Interactive Master Balance Card Frame */}
            <div className="mx-4 mt-6 p-6 rounded-[2.5rem] bg-white border border-white/60 shadow-xl shadow-indigo-950/5 relative overflow-hidden">
              <div className="absolute right-4 bottom-16 opacity-90 pointer-events-none select-none">
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <span>Available wallet USDC</span>
                  <button onClick={() => setShowBalance(!showBalance)} className="text-slate-400 hover:text-slate-600">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </div>
                {loading ? (
                  <h1 className="text-3xl font-black text-slate-300">Loading…</h1>
                ) : (
                  <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                    {showBalance ? `$${formatAmount(walletUsdcBalance)}` : '••••••'}
                  </h1>
                )}
                <p className="text-xs font-semibold text-slate-400 font-mono">
                  {showBalance ? `Wallet: ${formatAmount(walletUsdcBalance)} USDC • ${formatAmount(walletXlmBalance)} XLM` : 'Wallet hidden'}
                </p>
                <p className="text-xs font-semibold text-slate-400 font-mono">
                  {showBalance ? `≈ ₱${formatAmount(totalEquivalentInPhp)} PHP` : '≈ ₱••••••'}
                </p>
                <div className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-[#E1F7EE] text-[#10B981] px-3 py-1 text-[11px] font-bold">
                  <SparkleStar className="w-3 h-3" />
                  Protected +₱{purchasingPowerSaved.toFixed(2)} from inflation
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-6 relative">
                <button onClick={() => togglePanel('deposit')} className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center border ${panel === 'deposit' ? 'bg-[#FFF0DC] border-orange-200' : 'bg-[#FFF7EE] hover:bg-[#FFEED9] border-orange-100'}`}>
                    <ActionIcon type="deposit" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Deposit</span>
                </button>

                <button onClick={() => togglePanel('withdraw')} disabled={!publicKey} className="flex flex-col items-center gap-2 disabled:opacity-40">
                  <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center border ${panel === 'withdraw' ? 'bg-[#EAE4FF] border-violet-200' : 'bg-[#F3F0FF] hover:bg-[#EAE4FF] border-violet-100'}`}>
                    <ActionIcon type="withdraw" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Withdraw</span>
                </button>

                <button onClick={() => { setPanel(null); setActiveTab('send_tab'); }} disabled={!publicKey} className="flex flex-col items-center gap-2 disabled:opacity-40">
                  <div className="w-12 h-12 rounded-2xl bg-[#F3F0FF] hover:bg-[#EAE4FF] transition-colors flex items-center justify-center border border-violet-100">
                    <ActionIcon type="send" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Send</span>
                </button>

                <button onClick={() => togglePanel('receive')} disabled={!publicKey} className="flex flex-col items-center gap-2 disabled:opacity-40">
                  <div className={`w-12 h-12 rounded-2xl transition-colors flex items-center justify-center border ${panel === 'receive' ? 'bg-[#EAE4FF] border-violet-200' : 'bg-[#F3F0FF] hover:bg-[#EAE4FF] border-violet-100'}`}>
                    <ActionIcon type="receive" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Receive</span>
                </button>
              </div>

              {!publicKey && (
                <p className="mt-4 text-center text-xs font-semibold text-slate-400">Connect your wallet to deposit, withdraw, or send.</p>
              )}

              {(error || msg || transferState.status !== 'idle') && (
                <div className="mt-4 space-y-1">
                  {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
                  {msg && <p className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><SparkleStar className="w-3 h-3" />{msg}</p>}
                  {transferState.status !== 'idle' && <p className="text-xs text-slate-400">{transferState.message}</p>}
                </div>
              )}

              {panel === 'deposit' && (
                <div className="mt-4 p-4 bg-[#FAF8FF] border border-violet-100 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400 uppercase">Slide to deposit</span>
                    <span className="text-[#6C5DD3] font-mono">{depositAmount} USDC</span>
                  </div>
                  <input
                    type="range" min="0" max="2000" step="10" value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    disabled={busy}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#6C5DD3] disabled:opacity-50"
                  />
                  <button onClick={handleDeposit} disabled={busy || loading} className="w-full py-2.5 rounded-xl bg-[#6C5DD3] text-white text-xs font-bold disabled:opacity-50">
                    {busy ? 'Processing…' : 'Confirm deposit'}
                  </button>
                </div>
              )}

              {panel === 'withdraw' && (
                <div className="mt-4 p-4 bg-[#FAF8FF] border border-violet-100 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400 uppercase">Slide to withdraw</span>
                    <span className="text-[#6C5DD3] font-mono">{withdrawAmount} USDC</span>
                  </div>
                  <input
                    type="range" min="0" max={Math.max(2000, Math.round(usdcBalance))} step="10" value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    disabled={busy}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#6C5DD3] disabled:opacity-50"
                  />
                  <button onClick={handleWithdraw} disabled={busy || loading} className="w-full py-2.5 rounded-xl bg-white border border-[#6C5DD3] text-[#6C5DD3] text-xs font-bold disabled:opacity-50">
                    {busy ? 'Processing…' : 'Confirm withdrawal'}
                  </button>
                </div>
              )}

              {panel === 'receive' && publicKey && (
                <div className="mt-4 p-4 bg-[#FAF8FF] border border-violet-100 rounded-3xl space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase">Your vault address</p>
                  <p className="break-all rounded-xl border border-violet-100 bg-white px-3 py-2.5 font-mono text-xs text-slate-700">{publicKey}</p>
                  <button onClick={handleCopyAddress} className="w-full py-2.5 rounded-xl bg-[#6C5DD3] text-white text-xs font-bold">
                    {copied ? 'Copied!' : 'Copy address'}
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 mt-8 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Balance overview</h3>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#6C5DD3]">Live</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Wallet USDC</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {walletBalances ? formatAmount(walletUsdcBalance) : '—'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">Available for deposits</p>
                </div>
                <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Vault balance</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {vaultSummaryLoading ? '…' : formatAmount(usdcBalance)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">Saved in the vault</p>
                </div>
                <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">My contribution</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {vaultSummaryLoading ? '…' : formatAmount(safeNumber(vaultSummary?.contribution))}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">Your share so far</p>
                </div>
                <div className="rounded-3xl border border-violet-100 bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Withdrawable</p>
                  <p className="mt-2 text-2xl font-black text-slate-800">
                    {vaultSummaryLoading ? '…' : formatAmount(safeNumber(vaultSummary?.withdrawable))}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">Based on lock and goal rules</p>
                </div>
              </div>

              <div className="rounded-4xl border border-violet-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Vault progress</p>
                    <h4 className="mt-1 text-base font-black text-slate-800">{vaultSummary?.purpose || 'Savings vault'}</h4>
                  </div>
                  <div className="rounded-full bg-[#ECE9FF] px-2.5 py-1 text-[11px] font-black text-[#6C5DD3]">
                    {vaultSummaryLoading ? 'Loading…' : `${vaultProgress.toFixed(0)}%`}
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-linear-to-r from-[#6C5DD3] to-[#8F7CFF]" style={{ width: `${Math.min(100, vaultProgress)}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                  <span>Goal: ${formatAmount(vaultGoal)}</span>
                  <span>Need: ${formatAmount(vaultRemaining)}</span>
                </div>
                {vaultSummary && (
                  <p className="mt-3 text-[11px] font-semibold text-slate-400">
                    {vaultSummary.status} · {vaultSummary.vaultType} · {vaultSummary.lockLabel}
                  </p>
                )}
                {!vaultSummary && !vaultSummaryLoading && (
                  <p className="mt-3 text-[11px] font-semibold text-slate-400">
                    Add a vault id to surface on-chain vault balance, contribution, and goal progress here.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Activity preview */}
            <div className="px-5 mt-8">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Recent activity</h3>
                <button onClick={() => setActiveTab('activity')} className="text-xs font-bold text-[#6C5DD3] hover:underline">View all</button>
              </div>

              <div className="mt-4 space-y-3">
                {recentPreview.length === 0 ? (
                  <p className="p-4 rounded-4xl bg-white border border-slate-50 shadow-md shadow-indigo-950/2 text-sm text-slate-400">
                    Your deposits, withdrawals, and transfers will appear here.
                  </p>
                ) : (
                  recentPreview.map((entry) => {
                    const v = entryVisual(entry.kind);
                    return (
                      <div key={entry.id} className="p-4 rounded-4xl bg-white border border-slate-50 shadow-md shadow-indigo-950/2 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full ${v.bg} ${v.fg} flex items-center justify-center shrink-0 font-black shadow-inner`}>{v.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-sm text-slate-800 truncate">{entry.title}</h4>
                          <p className="text-[11px] text-slate-400 truncate">{entry.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-slate-800">{entry.amount.toFixed(2)} {entry.asset}</span>
                          <p className="text-[10px] text-slate-300 font-mono">{new Date(entry.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mx-4 mt-6 overflow-hidden rounded-4xl bg-linear-to-br from-[#E8DDFF] via-[#F4EEFF] to-[#E3D7FF] p-5 border border-white/60 shadow-sm relative">
              <div className="absolute right-0 -bottom-2.5 opacity-40 pointer-events-none">
                <span className="text-6xl">🪴</span>
              </div>
              <p className="flex items-center gap-1.5 text-base font-black text-[#2D2375] tracking-tight">
                Small saves, strong pesos <SparkleStar className="w-4 h-4 text-[#6C5DD3]" />
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#5B4FBF]/80 leading-relaxed max-w-[75%]">
                Every dollar you protect here holds its value against peso inflation, star by star.
              </p>
            </div>
          </>
        )}

        {activeTab === 'send_tab' && (
          <div className="px-5 mt-6">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Send USDC</h3>
            <p className="mt-1 text-xs text-slate-400">Transfers need both sender and receiver approval before they are submitted.</p>

            {!publicKey ? (
              <p className="mt-4 p-4 rounded-3xl bg-white border border-violet-100 text-sm text-slate-400">Connect your wallet to send funds.</p>
            ) : (
              <div className="mt-4 p-4 bg-white border border-violet-100 rounded-3xl space-y-3">
                {(error || msg) && (
                  <div className="space-y-1">
                    {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
                    {msg && <p className="flex items-center gap-1 text-xs font-semibold text-emerald-500"><SparkleStar className="w-3 h-3" />{msg}</p>}
                  </div>
                )}

                {!pendingApproval && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">Recipient address</label>
                      <input
                        type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="GB..." disabled={busy}
                        className="w-full rounded-xl border border-violet-100 bg-[#FAF8FF] px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:border-[#6C5DD3] disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-400">Amount (USDC)</label>
                      <input
                        type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0.00" disabled={busy}
                        className="w-full rounded-xl border border-violet-100 bg-[#FAF8FF] px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:border-[#6C5DD3] disabled:opacity-50"
                      />
                    </div>
                    <button onClick={handleTransferRequest} disabled={!recipient || !transferAmount || busy} className="w-full py-3 rounded-xl bg-[#6C5DD3] text-white text-sm font-bold disabled:opacity-50">
                      {busy ? 'Processing…' : 'Start approval flow'}
                    </button>
                  </>
                )}

                {pendingApproval && (
                  <div className="space-y-3 rounded-2xl border border-violet-100 bg-[#FAF8FF] p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800">Approval status</span>
                      <span className="rounded-full bg-[#ECE9FF] px-2 py-1 text-[10px] uppercase tracking-wide text-[#6C5DD3] font-bold">{pendingApproval.status}</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-400">
                      <p>Sender: {pendingApproval.sender.slice(0, 8)}…{pendingApproval.sender.slice(-4)}</p>
                      <p>Recipient: {pendingApproval.recipient.slice(0, 8)}…{pendingApproval.recipient.slice(-4)}</p>
                      <p>Amount: {pendingApproval.amount.toFixed(7)} USDC</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {publicKey === pendingApproval.sender && !pendingApproval.senderAuthorized && (
                        <button onClick={handleApproveAsSender} disabled={busy} className="w-full rounded-xl bg-[#6C5DD3] px-3 py-2.5 font-bold text-white disabled:opacity-50">Approve as sender</button>
                      )}
                      {publicKey === pendingApproval.recipient && !pendingApproval.receiverAuthorized && (
                        <button onClick={handleApproveAsReceiver} disabled={busy} className="w-full rounded-xl bg-[#10B981] px-3 py-2.5 font-bold text-white disabled:opacity-50">Approve as receiver</button>
                      )}
                      {pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && publicKey === pendingApproval.sender && (
                        <button onClick={handleSubmitApprovedTransfer} disabled={busy} className="w-full rounded-xl bg-[#B8792E] px-3 py-2.5 font-bold text-white disabled:opacity-50">Submit transfer</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="px-5 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800 tracking-tight">All activity</h3>
              <button onClick={refresh} disabled={loading} className="text-xs font-bold text-[#6C5DD3] disabled:opacity-50">
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {history.length === 0 ? (
                <p className="p-4 rounded-4xl bg-white border border-slate-50 shadow-md shadow-indigo-950/2 text-sm text-slate-400">
                  Your deposits, withdrawals, and transfers will appear here.
                </p>
              ) : (
                history.map((entry) => {
                  const v = entryVisual(entry.kind);
                  return (
                    <div key={entry.id} className="p-4 rounded-4xl bg-white border border-slate-50 shadow-md shadow-indigo-950/2 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full ${v.bg} ${v.fg} flex items-center justify-center shrink-0 font-black shadow-inner`}>{v.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-slate-800 truncate">{entry.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{entry.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-slate-800">{entry.amount.toFixed(2)} {entry.asset}</span>
                        <p className="text-[10px] text-slate-300 font-mono">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="px-5 mt-6">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Profile</h3>
            <div className="mt-4 p-5 rounded-3xl bg-white border border-violet-100 shadow-md shadow-indigo-950/2 space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Wallet address</p>
                {publicKey ? (
                  <p className="mt-1 break-all rounded-xl border border-violet-100 bg-[#FAF8FF] px-3 py-2.5 font-mono text-xs text-slate-700">{publicKey}</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-400">No wallet connected.</p>
                )}
              </div>
              {publicKey && (
                <button onClick={handleCopyAddress} className="w-full py-2.5 rounded-xl bg-[#6C5DD3] text-white text-xs font-bold">
                  {copied ? 'Copied!' : 'Copy address'}
                </button>
              )}
              <div className="pt-2 border-t border-violet-50 flex justify-between text-xs text-slate-500">
                <span>Live forex rate</span>
                <span className="font-mono font-semibold text-slate-700">1 USD = ₱{phpRate.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-100/80 px-4 pt-3 pb-7 flex justify-between items-center rounded-t-[2.5rem] shadow-xl shadow-slate-950/20 z-40">
        {(['home', 'send_tab', 'activity', 'profile'] as Tab[]).map((tab) => {
          const isSelected = activeTab === tab;
          const label = tab === 'send_tab' ? 'Send' : tab;
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPanel(null); }}
              className="flex flex-col items-center justify-center gap-1 flex-1 transition-transform active:scale-95"
            >
              <NavIcon type={tab} active={isSelected} />
              <span className={`text-[10px] font-bold capitalize transition-colors ${isSelected ? 'text-[#6C5DD3]' : 'text-slate-400'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
