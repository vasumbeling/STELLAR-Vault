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
import QRCodeDisplay from './QRCodeDisplay';
import QRScanner from './QRScanner';
import NotificationBell from './NotificationBell';
import { loadProfile, loadTrustScore, type UserProfile, type TrustScore } from '@/lib/auth/verification';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** Builds a `stellar:` payment URI so scanning apps can prefill destination + amount. */
function buildPaymentUri(address: string, amount?: string): string {
  if (!amount || Number(amount) <= 0) return address;
  return `stellar:${address}?amount=${encodeURIComponent(amount)}`;
}

/** Parses a scanned QR payload into an address + optional amount. Accepts a bare
 *  Stellar public key, a `stellar:` URI, or a `web+stellar:pay` URI. */
function parseScannedPayload(raw: string): { address: string | null; amount: string | null } {
  const trimmed = raw.trim();

  if (STELLAR_ADDRESS_RE.test(trimmed)) {
    return { address: trimmed, amount: null };
  }

  try {
    const withoutScheme = trimmed.replace(/^web\+stellar:pay\??/i, '').replace(/^stellar:/i, '');
    const [maybeAddress, query] = withoutScheme.split('?');
    const params = new URLSearchParams(query ?? '');
    const address = (params.get('destination') || maybeAddress || '').trim();
    const amount = params.get('amount');
    if (STELLAR_ADDRESS_RE.test(address)) {
      return { address, amount };
    }
  } catch {
    // fall through to failure below
  }

  return { address: null, amount: null };
}

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
  onLogout: () => void | Promise<void>; 
}

type Panel = 'deposit' | 'withdraw' | 'receive' | 'send' | 'create' | null;
type Tab = 'home' | 'vaults' | 'activity' | 'profile';

/* ---------- SVG Icon Toolkit ---------- */

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

function NavIcon({ type, active }: { type: Tab; active: boolean }) {
  const color = active ? '#1A1A1A' : '#A4B0BE';
  if (type === 'home') {
    return (
      <svg className="w-5 h-5" fill={active ? '#A0F0F0' : 'none'} stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    );
  }
  if (type === 'activity') {
    return (
      <svg className="w-5 h-5" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    );
  }
  if (type === 'vaults') {
    return (
      <svg className="w-5 h-5" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="13" rx="2"></rect>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke={color} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4"></circle>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    </svg>
  );
}

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function SavingsDashboard({ publicKey, wallet, onLogout }: DashboardProps) {
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
  const [focusVaultId, setFocusVaultId] = useState<string | null>(null);

  // Form states
  const [depositAmount, setDepositAmount] = useState('250');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  // Sub-mode selectors
  const [sendMode, setSendMode] = useState<'amount' | 'qr'>('amount');
  const [receiveMode, setReceiveMode] = useState<'address' | 'qr'>('address');
  const [receiveRequestAmount, setReceiveRequestAmount] = useState('');
  const [scanError, setScanError] = useState('');
  const [scannedOk, setScannedOk] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<(() => Promise<void>) | null>(null);

  // Pending transfer approval — now backend-backed, fetched async instead of
  // read synchronously from localStorage.
  const [pendingApproval, setPendingApproval] = useState<PendingTransferApproval | null>(null);
  const [pendingLoading, setPendingLoading] = useState(false);

  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };

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
      if (publicKey) {
        const balances = await fetchBalances(publicKey);
        setWalletBalances(balances);
      }
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

  const refreshPendingApproval = useCallback(async () => {
    if (!publicKey) {
      setPendingApproval(null);
      return;
    }
    setPendingLoading(true);
    try {
      const transfers = await getPendingTransferApprovalsForAddress();
      setPendingApproval(transfers[0] ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load transfer requests');
    } finally {
      setPendingLoading(false);
    }
  }, [publicKey]);

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
    if (panel !== 'send' || sendMode !== 'qr') {
      setScanError('');
      setScannedOk(false);
    }
  }, [panel, sendMode]);

  useEffect(() => {
    void refreshPendingApproval();
  }, [refreshPendingApproval]);

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

  const handleQrScanResult = useCallback((raw: string) => {
    const { address, amount } = parseScannedPayload(raw);
    if (!address) {
      setScanError('That QR code did not contain a valid Stellar address.');
      setScannedOk(false);
      return;
    }
    setRecipient(address);
    if (amount) setTransferAmount(amount);
    setScanError('');
    setError('');
    setScannedOk(true);
    // Give the person a beat to see the "found" state before flipping to the form.
    setTimeout(() => {
      setSendMode('amount');
      setScannedOk(false);
    }, 700);
  }, []);

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
      throw e;
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
        const res = await authFetch('/api/faucet/usdc', {
          method: 'POST',
          body: JSON.stringify({ amount: depositAmount }),
        });
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
    setError('Cashing out is coming soon. Your funds stay safely in your wallet for now.');
  };

  const handleTransferRequest = async () => {
    if (!publicKey || !recipient || !transferAmount) return;
    setBusy(true); setError(''); setMsg('');
    try {
      await createPendingTransferApproval(recipient, Number(transferAmount));
      setMsg('Transfer request created. The receiver must approve it before it can be sent.');
      await refreshPendingApproval();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create transfer request');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAsSender = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey) return;
    setBusy(true); setError('');
    try {
      await updatePendingTransferApproval(pendingApproval.id);
      setMsg('Sender approval recorded. Waiting for receiver approval.');
      await refreshPendingApproval();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve transfer');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAsReceiver = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.recipient !== publicKey) return;
    setBusy(true); setError('');
    try {
      await updatePendingTransferApproval(pendingApproval.id);
      setMsg('Receiver approval recorded. The sender can now submit the transfer.');
      await refreshPendingApproval();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve transfer');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitApprovedTransfer = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey || !pendingApproval.senderAuthorized || !pendingApproval.receiverAuthorized) return;
    setBusy(true); setError(''); setMsg('');
    try {
      await runWithReauth(async () => {
        await transferUSDC(pendingApproval.recipient, pendingApproval.amount, {
          onCompleted: async () => {
            setRecipient(''); setTransferAmount('');
            await removePendingTransferApproval(pendingApproval.id);
            await refreshHistory(publicKey);
            await refreshPendingApproval();
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

  if (!configured) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white border border-slate-100 rounded-2xl text-slate-800 flex items-center gap-3">
        <p className="text-xs font-light tracking-wide text-slate-400">Deploy the Soroban tracking contract to access your assets.</p>
      </div>
    );
  }

  const walletUsdcBalance = safeNumber(walletBalances?.usdc);
  const usdcBalance = safeNumber(vaultSummary?.balance ?? safeNumber(state?.saved));
  const totalEquivalentInPhp = walletUsdcBalance * phpRate;
  const purchasingPowerSaved = walletUsdcBalance * (phpRate * 0.06);

return (
  <div className="max-w-md mx-auto min-h-210 bg-[#fffdfb] rounded-[2.5rem] overflow-hidden shadow-xl relative flex flex-col justify-between font-sans tracking-tight border border-slate-200/40 text-[#1A1A1A]">
    
    <div className="flex-1 pb-36 overflow-y-auto">
      <div className="px-6 pt-7 flex justify-between items-center">
        <div />
          <NotificationBell
            publicKey={publicKey}
            onNavigateToVault={(vaultId) => {
              setActiveTab('vaults');
              setFocusVaultId(vaultId);
              const onNavigateToVault = (vaultId: string) => {
                setActiveTab('vaults');
                setFocusVaultId(vaultId);
                // Safety net: clear automatically if nothing ever matches it.
                setTimeout(() => {
                  setFocusVaultId((current) => (current === vaultId ? null : current));
                }, 4000);
              };
            }}
          />
      </div>

      {activeTab === 'home' && (
        <>
          <div className="mx-4 mt-5 p-6 rounded-2xl bg-linear-to-br from-[#FF9F1C] to-[#F37A00] text-white shadow-md relative overflow-hidden">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 bg-white/10 rounded-xl pointer-events-none before:content-[''] before:absolute before:-top-4 before:left-1/2 before:-translate-x-1/2 before:w-16 before:h-16 before:border-[6px] before:border-white/10 before:rounded-t-full" />
            <div className="absolute right-14 top-1/2 -translate-y-1/2 w-3 h-3 bg-white/20 rounded-full pointer-events-none" />

            <div className="space-y-1.5 relative z-10">
              <div className="flex items-center gap-2 text-white/80 text-[11px] tracking-wider uppercase font-normal">
                <span>Total Balance</span>
                <button 
                  onClick={() => setShowBalance(!showBalance)} 
                  className="text-white/60 hover:text-white transition-colors"
                  aria-label="Toggle balance visibility"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xl font-light text-white/90">₱</span>
                {loading ? (
                  <h1 className="text-xl font-light text-white/60">Loading…</h1>
                ) : (
                  <h1 className="text-3xl font-medium tracking-tight leading-tight">
                    {showBalance ? totalEquivalentInPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '••••••'}
                  </h1>
                )}
              </div>
                <span className="text-xs font-normal tracking-wide text-white/80 block">
                  {showBalance ? `${walletUsdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC` : '•••••• USDC'}
                </span>
            </div>
          </div>

            {/* Spinning Dial Core Wrapper */}
            <div className="my-17">
              <Wheel 
                activeTab={activeTab} 
                panel={panel} 
                setActiveTab={(tab) => setActiveTab(tab as Tab)} 
                setPanel={setPanel} 
              />
            </div>

            {/* Slide Inline Configuration Panels */}
            {panel && (
              <div className="mx-4 mt-2 space-y-3">
                {(error || msg || transferState.status !== 'idle') && (
                  <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1 text-[11px]">
                    {error && <p className="text-rose-500 font-light">{error}</p>}
                    {msg && <p className="flex items-center gap-1 text-emerald-600 font-light"><SparkleStar className="w-3 h-3" />{msg}</p>}
                    {transferState.status !== 'idle' && <p className="text-slate-400 font-light">{transferState.message}</p>}
                  </div>
                )}

                {needsPin && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-3">
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
                      className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs outline-none focus:border-[#A0F0F0] disabled:opacity-50"
                    />
                    {pinError && <p className="text-[10px] text-rose-500">{pinError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleUnlockAndRetry}
                        disabled={unlocking || !pinInput}
                        className="flex-1 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white py-2.5 text-[10px] uppercase tracking-widest font-normal disabled:opacity-40"
                      >
                        {unlocking ? 'Unlocking…' : 'Unlock'}
                      </button>
                      <button
                        onClick={() => { setNeedsPin(false); setPinInput(''); setPinError(''); setPendingRetry(null); }}
                        disabled={unlocking}
                        className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* ---------- DEPOSIT & RECEIVE COMBINED CONTAINER ---------- */}
                {(panel === 'deposit' || panel === 'receive') && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 p-0.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <button 
                        type="button"
                        onClick={() => setPanel('deposit')}
                        className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${panel === 'deposit' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                      >
                        Deposit
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPanel('receive'); setReceiveMode('address'); }}
                        className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${panel === 'receive' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                      >
                        Receive
                      </button>
                    </div>

                    {panel === 'deposit' && (
                      <div className="space-y-3 animate-fadeIn">
                        <div className="space-y-1">
                          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Amount</label>
                          <div className="relative flex items-center">
                            <input
                              type="number" 
                              value={depositAmount} 
                              onChange={(e) => setDepositAmount(e.target.value)} 
                              placeholder="0.00" 
                              disabled={busy}
                              className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-16 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] disabled:opacity-50 transition-colors"
                            />
                            <span className="absolute right-4 text-[10px] text-slate-400">USDC</span>
                          </div>
                        </div>

                        <div className="bg-slate-50/50 px-3 py-2 flex justify-between items-center text-[10px]">
                          <span className="uppercase text-slate-400 font-light tracking-wider">Value</span>
                          <span className="text-slate-500">
                            ₱{((Number(depositAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button 
                          onClick={handleDeposit} 
                          disabled={busy || loading || !depositAmount || Number(depositAmount) <= 0} 
                          className="w-full py-3 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest hover:opacity-95 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {busy && (
                            <svg className="animate-spin h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          )}
                          <span>{busy ? 'Processing...' : 'Deposit'}</span>
                        </button>
                      </div>
                    )}

                    {panel === 'receive' && publicKey && (
                      <div className="space-y-3 animate-fadeIn">
                        <div className="grid grid-cols-2 p-0.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <button 
                            onClick={() => setReceiveMode('address')}
                            className={`py-1 text-[9px] uppercase tracking-wider rounded-md transition-all ${receiveMode === 'address' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                          >
                            My Address
                          </button>
                          <button 
                            onClick={() => setReceiveMode('qr')}
                            className={`py-1 text-[9px] uppercase tracking-wider rounded-md transition-all ${receiveMode === 'qr' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                          >
                            QR Code
                          </button>
                        </div>

                        {receiveMode === 'address' ? (
                          <div className="space-y-2 animate-fadeIn">
                            <p className="break-all rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed font-mono">{publicKey}</p>
                            <button 
                              onClick={handleCopyAddress} 
                              className="w-full py-2.5 rounded-xl bg-[#E0FBFB] text-slate-800 text-[10px] uppercase tracking-wider font-light"
                            >
                              {copied ? 'Copied Securely' : 'Copy Key'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-2 space-y-3 animate-fadeIn">
                            <QRCodeDisplay value={buildPaymentUri(publicKey, receiveRequestAmount)} size={176} />

                            <div className="w-full space-y-1">
                              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">
                                Request Amount (optional)
                              </label>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  value={receiveRequestAmount}
                                  onChange={(e) => setReceiveRequestAmount(e.target.value)}
                                  placeholder="0.00"
                                  className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-14 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
                                />
                                <span className="absolute right-4 text-[10px] text-slate-400">USDC</span>
                              </div>
                            </div>

                            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-light text-center">
                              {receiveRequestAmount && Number(receiveRequestAmount) > 0
                                ? `Requesting ${Number(receiveRequestAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC`
                                : 'Scan to send to this wallet'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------- WITHDRAW CONTAINER ---------- */}
                {panel === 'withdraw' && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-4 animate-fadeIn">
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Withdraw</label>
                        <span className="text-[9px] text-slate-400 font-light">Balance: {usdcBalance.toFixed(2)}</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="number" 
                          value={withdrawAmount} 
                          onChange={(e) => setWithdrawAmount(e.target.value)} 
                          placeholder="0.00" 
                          disabled={busy}
                          className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-20 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
                        />
                        <div className="absolute right-2 flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 mr-1">USDC</span>
                          <button 
                            onClick={() => setWithdrawAmount(Math.floor(usdcBalance).toString())}
                            className="px-1.5 py-0.5 text-[9px] text-slate-600 bg-[#E0FBFB] rounded uppercase font-light"
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 px-3 py-2 flex justify-between items-center text-[10px]">
                      <span className="uppercase text-slate-400 font-light tracking-wider">Fiat Value</span>
                      <span className="text-slate-500">
                        ₱{((Number(withdrawAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <button disabled className="w-full py-3 rounded-xl bg-slate-50 text-slate-300 text-[10px] uppercase tracking-widest cursor-not-allowed font-light">
                      Feature Pending
                    </button>
                  </div>
                )}

                {/* ---------- SEND CONTAINER ---------- */}
                {panel === 'send' && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-4 animate-fadeIn">
                    {!publicKey ? (
                      <p className="p-4 bg-slate-50 text-[10px] text-slate-400 font-light text-center">Verify parameters to initialize transfer.</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 p-0.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <button 
                            type="button"
                            onClick={() => setSendMode('amount')}
                            className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${sendMode === 'amount' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                          >
                            Enter
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSendMode('qr')}
                            className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${sendMode === 'qr' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
                          >
                            Scan
                          </button>
                        </div>

                        {sendMode === 'amount' ? (
                          <>
                            {!pendingApproval && (
                              <div className="space-y-3 animate-fadeIn">
                                <div className="space-y-1">
                                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Address</label>
                                  <input
                                    type="text" 
                                    value={recipient} 
                                    onChange={(e) => setRecipient(e.target.value)} 
                                    placeholder="Stellar Public Address (G...)" 
                                    disabled={busy}
                                    className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] font-mono text-slate-600 outline-none focus:border-[#A0F0F0] transition-colors"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Amount</label>
                                  <div className="relative flex items-center">
                                    <input
                                      type="number" 
                                      value={transferAmount} 
                                      onChange={(e) => setTransferAmount(e.target.value)} 
                                      placeholder="0.00" 
                                      disabled={busy}
                                      className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-14 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
                                    />
                                    <span className="absolute right-4 text-[10px] text-slate-400">USDC</span>
                                  </div>
                                </div>

                                <button 
                                  type="button"
                                  onClick={handleTransferRequest}
                                  disabled={busy || !recipient || !transferAmount || Number(transferAmount) <= 0}
                                  className="w-full py-3 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest hover:opacity-95 transition-opacity disabled:opacity-40"
                                >
                                  {busy ? 'Sending Request…' : 'Request'}
                                </button>
                              </div>
                            )}

                            {pendingApproval && (
                              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 text-[11px] animate-fadeIn">
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                  <span className="text-[10px] uppercase text-slate-400 font-light tracking-wider">Pending Tx</span>
                                  <span className="font-normal text-slate-800">{pendingApproval.amount} USDC</span>
                                </div>
                                <div className="space-y-0.5 text-slate-400 font-light text-[10px]">
                                  <p className="truncate"><span className="uppercase tracking-wide">From:</span> {pendingApproval.sender}</p>
                                  <p className="truncate"><span className="uppercase tracking-wide">To:</span> {pendingApproval.recipient}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[9px] tracking-wide text-center uppercase font-light">
                                  <div className={`p-1.5 rounded-lg border ${pendingApproval.senderAuthorized ? 'bg-[#E0FBFB] border-[#A0F0F0] text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                    Sender {pendingApproval.senderAuthorized ? '✓' : '○'}
                                  </div>
                                  <div className={`p-1.5 rounded-lg border ${pendingApproval.receiverAuthorized ? 'bg-[#E0FBFB] border-[#A0F0F0] text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                    Receiver {pendingApproval.receiverAuthorized ? '✓' : '○'}
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                  {pendingApproval.sender === publicKey && !pendingApproval.senderAuthorized && (
                                    <button type="button" onClick={handleApproveAsSender} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-wider disabled:opacity-50">
                                      Sign Sender
                                    </button>
                                  )}
                                  {pendingApproval.recipient === publicKey && !pendingApproval.receiverAuthorized && (
                                    <button type="button" onClick={handleApproveAsReceiver} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-wider disabled:opacity-50">
                                      Sign Receiver
                                    </button>
                                  )}
                                  {pendingApproval.sender === publicKey && pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && (
                                    <button type="button" onClick={handleSubmitApprovedTransfer} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest font-normal disabled:opacity-50">
                                      {busy ? 'Processing…' : 'Submit Payload'}
                                    </button>
                                  )}
                                  <button 
                                    type="button" 
                                    disabled={busy}
                                    onClick={async () => {
                                      setBusy(true);
                                      try {
                                        await removePendingTransferApproval(pendingApproval.id);
                                        setError(''); setMsg('');
                                        await refreshPendingApproval();
                                      } catch (e: unknown) {
                                        setError(e instanceof Error ? e.message : 'Failed to cancel transfer request');
                                      } finally {
                                        setBusy(false);
                                      }
                                    }}
                                    className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-[10px] uppercase tracking-wide disabled:opacity-50"
                                  >
                                    Void
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3 animate-fadeIn">
                            <QRScanner
                              active={panel === 'send' && sendMode === 'qr' && !pendingApproval && !needsPin}
                              onScan={handleQrScanResult}
                            />
                            {scannedOk && (
                              <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-light">
                                <SparkleStar className="w-3 h-3" />
                                Address captured
                              </p>
                            )}
                            {scanError && (
                              <p className="text-[10px] text-rose-500 font-light text-center px-4">{scanError}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ---------- CREATE VAULT CONTAINER ---------- */}
                {panel === 'create' && publicKey && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-2 text-[#1A1A1A] animate-fadeIn">
                    <CreateVault
                      publicKey={publicKey}
                      onCreated={() => {
                        setPanel(null);
                        setMsg('Vault initialized.');
                        void refresh();
                        setTimeout(() => setMsg(''), 3000);
                      }}
                    />
                  </div>
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
          <Vaults
            publicKey={publicKey}
            loading={loading}
            onWalletChanged={refresh}
            focusVaultId={focusVaultId}
            onFocusHandled={() => setFocusVaultId(null)}
          />
        )}

      </div>

      {/* Fixed Floating Dock Menu */}
      <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/50 px-4 pt-3 pb-7 flex justify-between items-center rounded-t-4xl shadow-sm z-40">
        {(['home', 'vaults', 'activity', 'profile'] as Tab[]).map((tab) => {
          const isSelected = activeTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPanel(null);
              }}
              className="flex flex-col items-center justify-center flex-1 relative py-1.5"
            >
              {isSelected && (
                <div className="absolute w-10 h-10 bg-[#9AFAFA] rounded-xl -z-10 opacity-40 scale-105 transition-all" />
              )}
              <NavIcon type={tab} active={isSelected} />
            </button>
          );
        })}
      </div>

    </div>
  );
}