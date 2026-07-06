'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchBalances, type Balances } from '@/lib/balances';
import { walletService, authFetch } from '@/lib/wallet';
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
        const res = await authFetch('/api/faucet/usdc', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? 'Failed to fund wallet with test USDC.');
        }
        await refresh();
        await refreshHistory(publicKey);
        setMsg(`Received ${data.amount} test USDC!`);
        setPanel(null);
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Deposit failed');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleWithdraw = async () => {
    setError('');
    setMsg('');
    setError('Cashing out to is coming soon. Your funds stay safely in your wallet for now.');
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

                {/* ---------- DEPOSIT & RECEIVE COMBINED CONTAINER ---------- */}
                {(panel === 'deposit' || panel === 'receive') && (
                  <div className="rounded-4xl bg-white p-6 shadow-sm border border-[#e4beb1]/30 space-y-4 text-[#1e1b18] animate-fadeIn">
                    {/* Header Pipeline Info */}
                    <div>
                      <h2 className="text-sm font-black text-[#a73a00] tracking-tight uppercase">
                        {panel === 'deposit' ? 'Deposit' : 'Receive'}
                      </h2>
                    </div>

                    {/* Operational Mode Segment Selector */}
                    <div className="grid grid-cols-2 p-1 bg-[#fbf2ed]/60 border border-[#e4beb1]/20 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setPanel('deposit')}
                        className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${panel === 'deposit' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/50'}`}
                      >
                        Deposit
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPanel('receive'); setReceiveMode('address'); }}
                        className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${panel === 'receive' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/50'}`}
                      >
                        Receive
                      </button>
                    </div>

                    {/* SUB-FLOW A: DEPOSIT SYSTEM */}
                    {panel === 'deposit' && (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">ENTER AMOUNT</label>
                          <div className="relative flex items-center">
                            <input
                              type="number" 
                              value={depositAmount} 
                              onChange={(e) => setDepositAmount(e.target.value)} 
                              placeholder="0.00" 
                              disabled={busy}
                              className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 pl-3 pr-16 py-2.5 text-sm font-bold text-[#1e1b18] placeholder-[#5b4137]/30 outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors"
                            />
                            <span className="absolute right-4 text-xs font-black text-[#5b4137]/50">USDC</span>
                          </div>
                        </div>

                        {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                        <div className="bg-[#fff8f5] border border-[#e4beb1]/20 rounded-xl px-4 py-2.5 flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase text-[#5b4137] tracking-wider">Estimated Value</span>
                          <span className="text-xs font-black text-[#ff5c00]">
                            ₱{((Number(depositAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                          </span>
                        </div>

                        <button 
                          onClick={handleDeposit} 
                          disabled={busy || loading || !depositAmount || Number(depositAmount) <= 0} 
                          className="w-full py-3 rounded-xl bg-[#ff5c00] text-white text-xs font-black tracking-widest uppercase hover:bg-[#a73a00] transition-all disabled:opacity-40 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          {busy && (
                            <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          )}
                          <span>{busy ? 'Processing Transaction…' : 'Deposit'}</span>
                        </button>
                      </div>
                    )}

                    {/* SUB-FLOW B: RECEIVE PROTOCOL */}
                    {panel === 'receive' && publicKey && (
                      <div className="space-y-4 animate-fadeIn">
                        {/* Internal Address vs QR mini switcher */}
                        <div className="grid grid-cols-2 p-0.5 bg-[#fbf2ed]/30 border border-[#e4beb1]/10 rounded-lg">
                          <button 
                            onClick={() => setReceiveMode('address')}
                            className={`py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${receiveMode === 'address' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/40'}`}
                          >
                            My Address
                          </button>
                          <button 
                            onClick={() => setReceiveMode('qr')}
                            className={`py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all ${receiveMode === 'qr' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/40'}`}
                          >
                            Show QR Code
                          </button>
                        </div>

                        {receiveMode === 'address' ? (
                          <div className="space-y-3 animate-fadeIn">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">STELLA Vault Address</label>
                            <p className="break-all rounded-xl border border-[#e4beb1]/20 bg-[#fbf2ed]/30 px-3 py-3 font-mono text-xs text-[#1e1b18] leading-relaxed">{publicKey}</p>
                            <button 
                              onClick={handleCopyAddress} 
                              className="w-full py-2.5 rounded-xl bg-[#fff8f5] border border-[#e4beb1]/30 text-[#a73a00] text-xs font-bold hover:bg-[#fbf2ed]/50 transition-colors active:scale-[0.99]"
                            >
                              {copied ? 'Copied Securely!' : 'Copy to Clipboard'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 space-y-3 animate-fadeIn">
                            <div className="w-32 h-32 bg-white border border-[#e4beb1]/30 p-2 rounded-2xl flex items-center justify-center relative">
                              <div className="absolute inset-0 bg-[#a73a00]/5 flex items-center justify-center rounded-2xl">
                                <div className="w-20 h-20 border-[3px] border-[#1e1b18] flex flex-wrap p-1 gap-1 bg-white">
                                  <div className="w-5 h-5 bg-[#1e1b18]" />
                                  <div className="w-5 h-5 bg-transparent" />
                                  <div className="w-5 h-5 bg-[#1e1b18]" />
                                  <div className="w-full h-1 bg-[#1e1b18]" />
                                  <div className="w-4 h-4 bg-[#1e1b18]" />
                                  <div className="w-6 h-4 bg-[#1e1b18]" />
                                </div>
                              </div>
                            </div>
                            <span className="text-[9px] font-black tracking-widest text-[#5b4137]/60 uppercase">Scan to send</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------- WITHDRAW CONTAINER ---------- */}
                {panel === 'withdraw' && (
                  <div className="rounded-4xl bg-white p-6 shadow-sm border border-[#e4beb1]/30 space-y-4 text-[#1e1b18] animate-fadeIn">
                    <div>
                      <h2 className="text-sm font-black text-[#a73a00] tracking-tight uppercase">Withdraw</h2>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">ENTER AMOUNT</label>
                        <span className="text-[9px] font-bold text-[#5b4137]/50 font-mono">Max: {usdcBalance.toFixed(2)}</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="number" 
                          value={withdrawAmount} 
                          onChange={(e) => setWithdrawAmount(e.target.value)} 
                          placeholder="0.00" 
                          disabled={busy}
                          className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 pl-3 pr-24 py-2.5 text-sm font-bold text-[#1e1b18] placeholder-[#5b4137]/30 outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors"
                        />
                        <div className="absolute right-3 flex items-center gap-1.5">
                          <span className="text-xs font-black text-[#5b4137]/50">USDC</span>
                          <button 
                            onClick={() => setWithdrawAmount(Math.floor(usdcBalance).toString())}
                            className="px-2 py-1 text-[9px] font-black tracking-wider text-[#ff5c00] bg-[#fff8f5] border border-[#e4beb1]/30 rounded-md uppercase hover:bg-[#fbf2ed] transition-colors"
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                    <div className="bg-[#fff8f5] border border-[#e4beb1]/20 rounded-xl px-4 py-2.5 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase text-[#5b4137] tracking-wider">Estimated Value</span>
                      <span className="text-xs font-black text-[#ff5c00]">
                        ₱{((Number(withdrawAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                      </span>
                    </div>

                    <button disabled className="w-full py-3 rounded-xl bg-[#e9e1dc] text-[#5b4137]/50 text-xs font-black tracking-widest uppercase cursor-not-allowed">
                      Coming Soon
                    </button>
                  </div>
                )}

                {/* ---------- SEND CONTAINER ---------- */}
                {panel === 'send' && (
                  <div className="rounded-4xl bg-white p-6 shadow-sm border border-[#e4beb1]/30 space-y-4 text-[#1e1b18] animate-fadeIn">
                    <div>
                      <h2 className="text-sm font-black text-[#a73a00] tracking-tight uppercase">Send</h2>
                    </div>

                    {!publicKey ? (
                      <p className="p-4 rounded-xl bg-[#fbf2ed]/40 text-xs text-[#5b4137]/50 font-medium text-center">Verify structural keys to invoke transmission parameters.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 p-1 bg-[#fbf2ed]/60 border border-[#e4beb1]/20 rounded-xl">
                          <button 
                            type="button"
                            onClick={() => setSendMode('amount')}
                            className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sendMode === 'amount' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/50'}`}
                          >
                            Enter Amount
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSendMode('qr')}
                            className={`py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${sendMode === 'qr' ? 'bg-white text-[#a73a00] shadow-xs' : 'text-[#5b4137]/50'}`}
                          >
                            Scan QR Code
                          </button>
                        </div>

                        {sendMode === 'amount' ? (
                          <>
                            {!pendingApproval && (
                              <div className="space-y-3 animate-fadeIn">
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">Recipient Destination</label>
                                  <input
                                    type="text" 
                                    value={recipient} 
                                    onChange={(e) => setRecipient(e.target.value)} 
                                    placeholder="Stellar Public Address (G...)" 
                                    disabled={busy}
                                    className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 px-3 py-2.5 text-xs font-mono text-[#1e1b18] placeholder-[#5b4137]/30 outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#5b4137]">ENTER AMOUNT</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type="number" 
                                      value={transferAmount} 
                                      onChange={(e) => setTransferAmount(e.target.value)} 
                                      placeholder="0.00" 
                                      disabled={busy}
                                      className="w-full rounded-xl bg-[#fbf2ed]/40 border border-[#e4beb1]/30 pl-3 pr-16 py-2.5 text-sm font-bold text-[#1e1b18] placeholder-[#5b4137]/30 outline-none focus:border-[#a73a00] disabled:opacity-50 transition-colors"
                                    />
                                    <span className="absolute right-4 text-xs font-black text-[#5b4137]/50">USDC</span>
                                  </div>
                                </div>

                                {/* LIVE VISIBLE PHP EQUIVALENT ESTIMATE BOX */}
                                <div className="bg-[#fff8f5] border border-[#e4beb1]/20 rounded-xl px-4 py-2.5 flex justify-between items-center">
                                  <span className="text-[10px] font-bold uppercase text-[#5b4137] tracking-wider">Estimated Value</span>
                                  <span className="text-xs font-black text-[#ff5c00]">
                                    ₱{((Number(transferAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHP
                                  </span>
                                </div>

                                <button 
                                  type="button"
                                  onClick={handleTransferRequest}
                                  disabled={!recipient || !transferAmount || Number(transferAmount) <= 0}
                                  className="w-full py-3 rounded-xl bg-[#ff5c00] text-white text-xs font-black tracking-widest uppercase hover:bg-[#a73a00] transition-all disabled:opacity-40 active:scale-[0.98]"
                                >
                                  Request
                                </button>
                              </div>
                            )}

                            {pendingApproval && (
                              <div className="rounded-xl border border-[#e4beb1]/40 bg-[#fff8f5] p-4 space-y-3 animate-fadeIn">
                                <div className="flex justify-between items-center border-b border-[#e4beb1]/20 pb-2">
                                  <span className="text-[10px] font-black uppercase text-[#a73a00] tracking-wider">Pending Transfer Agreement</span>
                                  <span className="text-xs font-mono font-bold text-[#ff5c00]">{pendingApproval.amount} USDC</span>
                                </div>
                                <div className="text-[11px] space-y-1 text-[#5b4137] font-medium">
                                  <p className="truncate"><span className="font-bold">From:</span> {pendingApproval.sender}</p>
                                  <p className="truncate"><span className="font-bold">To:</span> {pendingApproval.recipient}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-bold text-center">
                                  <div className={`p-2 rounded-lg border ${pendingApproval.senderAuthorized ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-[#e9e1dc]/50 border-[#e4beb1]/30 text-[#5b4137]/60'}`}>
                                    Sender {pendingApproval.senderAuthorized ? '✓ Verified' : '○ Needed'}
                                  </div>
                                  <div className={`p-2 rounded-lg border ${pendingApproval.receiverAuthorized ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-[#e9e1dc]/50 border-[#e4beb1]/30 text-[#5b4137]/60'}`}>
                                    Receiver {pendingApproval.receiverAuthorized ? '✓ Verified' : '○ Needed'}
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                  {pendingApproval.sender === publicKey && !pendingApproval.senderAuthorized && (
                                    <button type="button" onClick={handleApproveAsSender} className="flex-1 py-2 rounded-xl bg-[#ff5c00] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#a73a00] transition-colors">
                                      Sign as Sender
                                    </button>
                                  )}
                                  {pendingApproval.recipient === publicKey && !pendingApproval.receiverAuthorized && (
                                    <button type="button" onClick={handleApproveAsReceiver} className="flex-1 py-2 rounded-xl bg-[#ff5c00] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#a73a00] transition-colors">
                                      Sign as Receiver
                                    </button>
                                  )}
                                  {pendingApproval.sender === publicKey && pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && (
                                    <button type="button" onClick={handleSubmitApprovedTransfer} disabled={busy} className="flex-1 py-2 rounded-xl bg-[#9AFAFA] text-[#0F4F53] text-[11px] font-black uppercase tracking-widest hover:bg-[#7becec] transition-colors">
                                      {busy ? 'Deploying Payload…' : 'Submit Settlement'}
                                    </button>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => { removePendingTransferApproval(pendingApproval.id); setError(''); setMsg(''); }}
                                    className="px-3 py-2 rounded-xl bg-[#e9e1dc] text-[#5b4137] text-[11px] font-bold uppercase hover:bg-[#dfd5ce] transition-colors"
                                  >
                                    Void
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#e4beb1]/40 rounded-2xl bg-[#fff8f5]/40 animate-fadeIn">
                            <span className="material-symbols-outlined text-3xl text-[#ff5c00]/40 animate-pulse">qr_code_scanner</span>
                            <span className="text-[10px] font-black tracking-widest text-[#5b4137]/60 uppercase mt-2">Open Camera...</span>
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