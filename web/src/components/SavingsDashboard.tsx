'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchBalances, type Balances } from '@/lib/balances';
import { walletService } from '@/lib/wallet';
import {
  contractConfigured,
  readSavingsState,
  readVaultBalanceSummary,
  resolveVaultId,
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
import Wheel from './Wheel';
import History from './History';
import Profile from './Profile';
import Vaults from './Vaults';
import CreateVault from './vault/CreateVault';
import { loadProfile, loadTrustScore, type UserProfile, type TrustScore } from '@/lib/auth/verification';

interface WalletContextProps {
  publicKey: string | null;
  connecting: boolean;
  status: string;
  network: string;
  provider: string;
  signerAvailable: boolean;
  error: string | null;
  disconnect?: () => void;
}

interface DashboardProps {
  publicKey: string | null;
  wallet: WalletContextProps; 
}

type Panel = 'deposit' | 'withdraw' | 'receive' | 'send' | 'create' | null;
type Tab = 'home' | 'vaults' | 'activity' | 'profile';

/* ---------- SVG Icon Toolkit ---------- */

function EyeIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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

function NavIcon({ type, active }: { type: Tab; active: boolean }) {
  const color = active ? '#1A1A1A' : '#A4B0BE';
  if (type === 'home') {
    return (
      <svg className="w-6 h-6" fill={active ? '#A0F0F0' : 'none'} stroke={color} strokeWidth="2.2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    );
  }
  if (type === 'activity') {
    return (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth="2.2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    );
  }
  if (type === 'vaults') {
    return (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth="2.2" viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="13" rx="2"></rect>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth="2.2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4"></circle>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    </svg>
  );
}

  const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function SavingsDashboard({ publicKey, wallet }: DashboardProps) {
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trust, setTrust] = useState<TrustScore | null>(null);

  // Form states
  const [depositAmount, setDepositAmount] = useState('250');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // Sub-mode selectors for Options (Amount Input vs QR)
  const [sendMode, setSendMode] = useState<'amount' | 'qr'>('amount');
  const [receiveMode, setReceiveMode] = useState<'address' | 'qr'>('address');
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null);

  const safeNumber = (v: unknown): number => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
  };

  const onLogout = useCallback(() => {
    wallet.disconnect?.();
  }, [wallet]);

  const loadVaultSummary = useCallback(async (key: string | null) => {
    if (!key) {
      setVaultSummary(null);
      return;
    }
    setVaultSummaryLoading(true);
    try {
      const summary = await readVaultBalanceSummary(key);
      setVaultSummary(summary);
    } catch {
      setVaultSummary(null);
    } finally {
      setVaultSummaryLoading(false);
    }
  }, []);

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
    if (!address) { setHistory([]); return; }
    setHistory(await loadHistory(address));
  }, []);

  useEffect(() => {
    setProfile(loadProfile());
    setTrust(loadTrustScore());
  }, []);

  useEffect(() => {
    if (!configured) return;
    let ignore = false;
    setLoading(true);
    setError('');
    readSavingsState()
      .then((next) => { if (!ignore) setState(next); })
      .catch((e: unknown) => { if (!ignore) setError(e instanceof Error ? e.message : 'Failed to read contract'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [configured]);

  useEffect(() => {
    let ignore = false;
    if (!publicKey) { setHistory([]); return; }
    loadHistory(publicKey).then((data) => { if (!ignore) setHistory(data); });
    return () => { ignore = true; };
  }, [publicKey]);

  useEffect(() => {
    let ignore = false;
    if (!publicKey) { setWalletBalances(null); return; }
    fetchBalances(publicKey)
      .then((b) => { if (!ignore) setWalletBalances(b); })
      .catch(() => { if (!ignore) setWalletBalances(null); });
    return () => { ignore = true; };
  }, [publicKey]);

  useEffect(() => {
    let ignore = false;
    if (!publicKey) { setVaultSummary(null); return; }
    loadVaultSummary(publicKey).then(() => { }).catch(() => { });
    return () => { ignore = true; };
  }, [loadVaultSummary, publicKey]);

  useEffect(() => subscribeToTransferState(() => setTransferState(getTransferState())), []);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((d) => { if (d?.rates?.PHP) setPhpRate(d.rates.PHP); })
      .catch(() => { });
  }, []);

  /* ---------- Handlers ---------- */

  const handleCopyAddress = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  /**
   * Runs a money-moving action. If it fails specifically because the
   * in-memory session key is missing (e.g. after a page reload), shows an
   * inline PIN prompt and remembers the action so it can retry automatically
   * once the user unlocks again — instead of a dead-end error.
   */
  const runWithReauth = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Action failed';
      if (message === SESSION_KEY_MISSING_MESSAGE) {
        setPendingRetry(() => action);
        setNeedsPin(true);
        return;
      }
      throw e; // let the caller's existing catch block handle any other error
    }
  };

  const handleUnlockAndRetry = async () => {
    setUnlocking(true);
    setPinError('');
    try {
      await walletService.unlockPinAccount(pinInput);
      setNeedsPin(false);
      setPinInput('');
      if (pendingRetry) {
        await pendingRetry();
        setPendingRetry(null);
      }
    } catch (e: unknown) {
      setPinError(e instanceof Error ? e.message : 'Incorrect PIN');
    } finally {
      setUnlocking(false);
    }
  };

  const handleDeposit = async () => {
    if (!publicKey || !depositAmount || Number(depositAmount) <= 0) return;
    setBusy(true); setError(''); setMsg('');
    try {
      await runWithReauth(async () => {
        await depositUSDC(depositAmount, { onCompleted: async () => { await refresh(); await refreshHistory(publicKey); } });
        setMsg('Contribution saved successfully!');
        setPanel(null);
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Contribution failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleWithdraw = async () => {
    if (!publicKey || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    setBusy(true); setError(''); setMsg('');
    try {
      await runWithReauth(async () => {
        await withdrawUSDC(withdrawAmount, { onCompleted: async () => { await refresh(); await refreshHistory(publicKey); } });
        setMsg('Withdrawal completed successfully!');
        setPanel(null);
      });
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

  const pendingApproval = useMemo<PendingTransferApproval | null>(() => {
    if (!publicKey) return null;
    return getPendingTransferApprovalsForAddress(publicKey).find((item) => item.status !== 'submitted') ?? null;
  }, [publicKey]);

  const handleApproveAsSender = () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey) return;
    if (updatePendingTransferApproval(pendingApproval.id, { senderAuthorized: true }))
      setMsg('Sender approval recorded. Waiting for receiver approval.');
  };

  const handleApproveAsReceiver = () => {
    if (!pendingApproval || !publicKey || pendingApproval.recipient !== publicKey) return;
    if (updatePendingTransferApproval(pendingApproval.id, { receiverAuthorized: true }))
      setMsg('Receiver approval recorded. The sender can now submit the transfer.');
  };

  const handleSubmitApprovedTransfer = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey || !pendingApproval.senderAuthorized || !pendingApproval.receiverAuthorized) return;
    setBusy(true); setError(''); setMsg('');
    try {
      await runWithReauth(async () => {
        await transferUSDC(pendingApproval.recipient, pendingApproval.amount, {
          onCompleted: async () => {
            setRecipient(''); setTransferAmount('');
            removePendingTransferApproval(pendingApproval.id);
            await refreshHistory(publicKey);
          },
        });
        setMsg('USDC transfer completed successfully!');
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  /* ---------- Derived values ---------- */

  if (!configured) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white border border-orange-100 rounded-3xl text-slate-800 shadow-xl flex items-center gap-3">
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const identity = publicKey ? `${publicKey.slice(0, 4)}…${publicKey.slice(-4)}` : 'Guest';

  /* ---------- Render ---------- */

  return (
    <div className="max-w-md mx-auto min-h-210 bg-[#FAF8F5] rounded-[3.2rem] overflow-hidden shadow-2xl relative flex flex-col justify-between font-sans border border-slate-200/50">

      {/* Primary Scroll Container */}
      <div className="flex-1 pb-36 overflow-y-auto">

        {/* Global Structural Layout Header */}
        <div className="px-6 pt-7 flex justify-between items-center">
          
        </div>

        {/* === MAIN HOME INTERFACE === */}
        {activeTab === 'home' && (
          <>
            {/* The Master Card Element */}
            <div className="mx-4 mt-5 p-7 rounded-[2.2rem] bg-linear-to-br from-[#FF7A1A] to-[#FF4E00] text-white shadow-xl shadow-orange-700/10 relative overflow-hidden ring-10 ring-cyan-300/30">
              
              <div className="space-y-3 relative z-10">
                {/* Balance Toggle Field */}
                <div className="flex items-center gap-2 text-white/70 text-xs font-bold tracking-wide uppercase">
                  <span>Vault Assets</span>
                  <button onClick={() => setShowBalance(!showBalance)} className="text-white/70 hover:text-white transition-colors">
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Dynamic Ledger Row - Defaulted to PHP */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-orange-100 opacity-90 font-sans">₱</span>
                  {loading ? (
                    <h1 className="text-4xl font-black text-orange-200/50">Loading…</h1>
                  ) : (
                    <h1 className="text-5xl font-black tracking-tight">
                      {showBalance ? totalEquivalentInPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '••••••'}
                    </h1>
                  )}
                  <span className="text-xs font-bold text-orange-100/80 uppercase tracking-wider ml-1 font-sans">PHP</span>
                </div>

                {/* Sub-conversion Asset Array - Shows underlying USDC */}
                <div className="pt-2 border-t border-white/10 flex items-center gap-4">
                  <div className="inline-block bg-white/15 px-3 py-1 rounded-xl text-xs font-black">
                    USDC ▾
                  </div>
                  <span className="text-xs font-bold text-orange-50/80 font-mono">
                    {showBalance ? `${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC` : '•••••• USDC'}
                  </span>
                </div>
              </div>
            </div>

            {/* Spinning Dial Core Wrapper */}
            <div className="mt-6">
              <Wheel 
                activeTab={activeTab} 
                panel={panel} 
                setActiveTab={(tab) => setActiveTab(tab as Tab)} 
                setPanel={setPanel} 
              />
            </div>

            
            {/* Slide Inline Configuration Panels */}
            {panel && (
              <div className="mx-4 mt-2 p-5 bg-white rounded-3xl border border-slate-100 shadow-md space-y-4">
                {(error || msg || transferState.status !== 'idle') && (
                  <div className="p-1.5 space-y-1">
                    {error && <p className="text-xs font-bold text-rose-500">{error}</p>}
                    {msg && <p className="flex items-center gap-1 text-xs font-bold text-emerald-600"><SparkleStar className="w-3 h-3" />{msg}</p>}
                    {transferState.status !== 'idle' && <p className="text-xs font-medium text-slate-400 font-mono">{transferState.message}</p>}
                  </div>
                )}

                {needsPin && (
                  <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-700">
                      Your session timed out. Enter your PIN to continue.
                    </p>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      placeholder="Enter PIN"
                      disabled={unlocking}
                      className="w-full rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-300 disabled:opacity-50"
                    />
                    {pinError && <p className="text-[11px] font-bold text-rose-600">{pinError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleUnlockAndRetry}
                        disabled={unlocking || !pinInput}
                        className="flex-1 rounded-xl bg-[#FF5E00] py-2.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        {unlocking ? 'Unlocking…' : 'Unlock & Continue'}
                      </button>
                      <button
                        onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); setPendingRetry(null); }}
                        disabled={unlocking}
                        className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* DEPOSIT CONTAINER */}
                {panel === 'deposit' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Deposit Amount</label>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">Currency: USDC</span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type="number" 
                        value={depositAmount} 
                        onChange={(e) => setDepositAmount(e.target.value)} 
                        placeholder="0.00" 
                        disabled={busy}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-16 py-3.5 text-base font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                      />
                      <span className="absolute right-4 text-xs font-black text-slate-400">USDC</span>
                    </div>

                    {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                    <div className="bg-orange-50/50 border border-orange-100/50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Value</span>
                      <span className="text-sm font-black text-[#FF5E00]">
                        ₱{((Number(depositAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                      </span>
                    </div>

                    <button onClick={handleDeposit} disabled={busy || loading || !depositAmount || Number(depositAmount) <= 0} className="w-full py-3.5 rounded-2xl bg-[#FF5E00] text-white text-xs font-black tracking-wider uppercase shadow-md shadow-orange-500/10 active:scale-[0.99] transition-transform disabled:opacity-40">
                      {busy ? 'Processing Transaction…' : 'Execute Deposit'}
                    </button>
                  </div>
                )}

                {/* WITHDRAW CONTAINER */}
                {panel === 'withdraw' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Withdraw Amount</label>
                      <span className="text-[11px] font-bold text-slate-400 font-mono">Max: {usdcBalance.toFixed(2)} USDC</span>
                    </div>
                    
                    <div className="relative flex items-center">
                      <input
                        type="number" 
                        value={withdrawAmount} 
                        onChange={(e) => setWithdrawAmount(e.target.value)} 
                        placeholder="0.00" 
                        disabled={busy}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-24 py-3.5 text-base font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                      />
                      <div className="absolute right-3 flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400">USDC</span>
                        <button 
                          onClick={() => setWithdrawAmount(Math.floor(usdcBalance).toString())}
                          className="px-2 py-1 text-[10px] font-black tracking-wide text-[#FF5E00] bg-orange-50 rounded-md uppercase"
                        >
                          Max
                        </button>
                      </div>
                    </div>

                    {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                    <div className="bg-orange-50/50 border border-orange-100/50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Value</span>
                      <span className="text-sm font-black text-[#FF5E00]">
                        ₱{((Number(withdrawAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                      </span>
                    </div>

                    <button onClick={handleWithdraw} disabled={busy || loading || !withdrawAmount || Number(withdrawAmount) <= 0} className="w-full py-3.5 mt-1 rounded-2xl bg-[#FF5E00] text-white text-xs font-black tracking-wider uppercase active:scale-[0.99] transition-transform disabled:opacity-40 shadow-md shadow-orange-500/10">
                      {busy ? 'Processing Transaction…' : 'Execute Withdrawal'}
                    </button>
                  </div>
                )}

                {/* RECEIVE CONTAINER */}
                {panel === 'receive' && publicKey && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                      <button 
                        onClick={() => setReceiveMode('address')}
                        className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${receiveMode === 'address' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
                      >
                        My Address
                      </button>
                      <button 
                        onClick={() => setReceiveMode('qr')}
                        className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${receiveMode === 'qr' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
                      >
                        Show QR Code
                      </button>
                    </div>

                    {receiveMode === 'address' ? (
                      <div className="space-y-3 animate-fadeIn">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Stellar Vault Address</p>
                        <p className="break-all rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3 font-mono text-xs text-slate-700 leading-normal">{publicKey}</p>
                        <button onClick={handleCopyAddress} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold active:bg-slate-200 transition-colors">
                          {copied ? 'Copied Securely!' : 'Copy to Clipboard'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 space-y-3 animate-fadeIn">
                        <div className="w-40 h-40 bg-white border border-slate-200 p-2 rounded-2xl shadow-inner flex items-center justify-center relative">
                          <div className="absolute inset-0 bg-slate-900/5 flex items-center justify-center rounded-2xl">
                            <div className="w-28 h-28 border-[3px] border-slate-800 flex flex-wrap p-1 gap-1 bg-white">
                              <div className="w-8 h-8 bg-slate-800" />
                              <div className="w-8 h-8 bg-transparent" />
                              <div className="w-8 h-8 bg-slate-800" />
                              <div className="w-full h-2 bg-slate-800" />
                              <div className="w-6 h-6 bg-slate-800" />
                              <div className="w-10 h-6 bg-slate-800" />
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Scan to send assets</span>
                      </div>
                    )}
                  </div>
                )}

                {/* SEND CONTAINER */}
                {panel === 'send' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Send Assets</h4>
                      <p className="text-[11px] text-slate-400 font-medium">Multi-sig flow requiring reciprocal action clearance before deployment.</p>
                    </div>

                    {!publicKey ? (
                      <p className="p-4 rounded-2xl bg-slate-50 text-xs text-slate-400 font-medium">Verify structural keys to invoke transmission parameters.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
                          <button 
                            type="button"
                            onClick={() => setSendMode('amount')}
                            className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sendMode === 'amount' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
                          >
                            Enter Amount
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSendMode('qr')}
                            className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sendMode === 'qr' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'}`}
                          >
                            Scan QR Code
                          </button>
                        </div>

                        {sendMode === 'amount' ? (
                          <>
                            {!pendingApproval && (
                              <div className="space-y-3 animate-fadeIn">
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Recipient Account Destination</label>
                                  <input
                                    type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="G..." disabled={busy}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 text-xs font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Payload Volume (USDC)</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0.00" disabled={busy}
                                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-16 py-3 text-sm font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                                    />
                                    <span className="absolute right-4 text-xs font-black text-slate-400">USDC</span>
                                  </div>
                                </div>

                                {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                                <div className="bg-orange-50/50 border border-orange-100/50 rounded-xl px-4 py-2.5 flex justify-between items-center">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estimated Value</span>
                                  <span className="text-sm font-black text-[#FF5E00]">
                                    ₱{((Number(transferAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                                  </span>
                                </div>

                                <button onClick={handleTransferRequest} disabled={!recipient || !transferAmount || busy} className="w-full py-3.5 mt-2 rounded-2xl bg-[#FF5E00] text-white text-xs font-black uppercase tracking-widest disabled:opacity-40 shadow-md shadow-orange-500/10">
                                  {busy ? 'Constructing Flow…' : 'Initialize Multi-Sig Stream'}
                                </button>
                              </div>
                            )}

                            {pendingApproval && (
                              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-slate-800 uppercase tracking-wide">Stream Phase</span>
                                  <span className="rounded-full bg-orange-100 px-3 py-1 text-[10px] uppercase tracking-wider text-[#FF5E00] font-black">{pendingApproval.status}</span>
                                </div>
                                <div className="space-y-1.5 text-[11px] text-slate-500 font-mono">
                                  <p className="truncate">Source: {pendingApproval.sender}</p>
                                  <p className="truncate">Target: {pendingApproval.recipient}</p>
                                  <div className="flex justify-between items-center mt-2 bg-white p-2 rounded-lg border border-slate-100">
                                    <span className="font-sans font-bold text-slate-800 text-xs">Value: {pendingApproval.amount.toFixed(2)} USDC</span>
                                    <span className="font-sans font-black text-[#FF5E00] text-xs">₱{(pendingApproval.amount * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2 })} PHP</span>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                  {publicKey === pendingApproval.sender && !pendingApproval.senderAuthorized && (
                                    <button onClick={handleApproveAsSender} disabled={busy} className="w-full rounded-xl bg-[#FF5E00] px-3 py-2.5 font-bold text-white disabled:opacity-50 text-xs uppercase tracking-wider shadow-md shadow-orange-500/10">Approve as Signatory Source</button>
                                  )}
                                  {publicKey === pendingApproval.recipient && !pendingApproval.receiverAuthorized && (
                                    <button onClick={handleApproveAsReceiver} disabled={busy} className="w-full rounded-xl bg-[#FF5E00] px-3 py-2.5 font-bold text-white disabled:opacity-50 text-xs uppercase tracking-wider shadow-md shadow-orange-500/10">Approve as Target Registry</button>
                                  )}
                                  {pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && publicKey === pendingApproval.sender && (
                                    <button onClick={handleSubmitApprovedTransfer} disabled={busy} className="w-full rounded-xl bg-[#FF5E00] px-3 py-2.5 font-black text-white disabled:opacity-50 text-xs uppercase tracking-wider shadow-md shadow-orange-500/10">Submit Block payload</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3 animate-fadeIn">
                            <svg className="w-10 h-10 text-slate-400 stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h4v4H6V4zm10 0h4v4h-4V4zM6 14h4v4H6v-4zm10 2h2v2h-2v-2zm2-2h2v2h-2v-2zm-2-2h2v2h-2v-2zm-2 2h2v2h-2v-2zm0-4h2v2h-2v-2zm2 0h2v2h-2v-2z" />
                            </svg>
                            <span className="text-[11px] font-bold text-slate-500">Camera Permission Request Pending…</span>
                            <button 
                              type="button"
                              onClick={() => {
                                setRecipient('GBCNM4ZQXH5X2WRNZV2TL6NQUU6NMX4XF6OQWLSK3LCE5WXT5E6MSTELLA');
                                setTransferAmount('100');
                                setSendMode('amount');
                                setMsg('Scanned data loaded successfully!');
                              }}
                              className="text-[10px] font-black uppercase text-[#FF5E00] bg-orange-50 px-2.5 py-1 rounded-md"
                            >
                              Mock Scan QR Code
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              {/* CREATE VAULT CONTAINER */}
                {panel === 'create' && publicKey && (
                  <CreateVault
                    publicKey={publicKey}
                    onCreated={() => {
                      setPanel(null);
                      setMsg('Vault created successfully!');
                      void refresh();
                      setTimeout(() => setMsg(''), 3000);
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* === ALL ACTIVITY LEDGER === */}
        {activeTab === 'activity' && (
          <History 
            history={history} 
            loading={loading} 
            onRefresh={refresh} 
          />
        )}

        {/* === PROFILE VIEW PANEL === */}
        {activeTab === 'profile' && (
          <Profile 
            publicKey={publicKey}
            phpRate={phpRate}
            copied={copied}
            purchasingPowerSaved={purchasingPowerSaved}
            onCopyAddress={handleCopyAddress}
            wallet={wallet}
            loading={loading}
            onRefresh={refresh}
            onLogout={onLogout}
          />
        )}
        {/* === VAULT VIEW PANEL === */}
        {activeTab === 'vaults' && (
          <Vaults publicKey={publicKey} loading={loading} />
        )}

      </div>

      {/* Mockup Fixed Floating Dock Menu */}
      <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 px-3 pt-4 pb-8 flex justify-between items-center rounded-t-[2.4rem] shadow-xl shadow-slate-900/10 z-40">
        {(['home', 'vaults', 'activity', 'profile'] as Tab[]).map((tab) => {
          const isSelected = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPanel(null);
              }}
              className="flex flex-col items-center justify-center flex-1 relative py-2"
            >
              {isSelected && (
                <div className="absolute w-12 h-12 bg-[#9AFAFA] rounded-xl -z-10 opacity-70 scale-105 transition-all" />
              )}
              <NavIcon type={tab} active={isSelected} />
            </button>
          );
        })}
      </div>

    </div>
  );
}