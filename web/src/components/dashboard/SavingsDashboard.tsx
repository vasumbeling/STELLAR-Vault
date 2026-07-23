'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { fetchBalances, type Balances } from '@/lib/balances';
import { walletService, authFetch } from '@/lib/wallet';
import {
  contractConfigured,
  readSavingsState,
  readVaultBalanceSummary,
  type SavingsState,
  type VaultBalanceSummary,
} from '@/lib/contract';
import {
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
import Wheel from '@/components/dashboard/Wheel';
import History from '@/components/dashboard/History';
import Profile from '@/components/profile/Profile';
import Vaults from '@/components/vault/Vaults';
import CreateVault from '@/components/vault/CreateVault';
import NotificationBell from '@/components/shared/NotificationBell';
import { useToast } from '@/components/shared/Toast';
import { loadProfile, loadTrustScore, type UserProfile, type TrustScore } from '@/lib/auth/verification';
import { EyeIcon, SparkleStar, NavIcon } from '@/app/icons';

/** currentColor-based glyphs so the active tab's orange color can be set by the wrapper. */
function NavGlyph({ type }: { type: Tab }) {
  if (type === 'home') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    );
  }
  if (type === 'activity') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    );
  }
  if (type === 'vaults') {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="3" y="7" width="18" height="13" rx="2"></rect>
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4"></circle>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    </svg>
  );
}


import PinUnlockPanel from './PinUnlockPanel';
import DepositReceivePanel from '@/components/dashboard/DepositReceivePanel';
import WithdrawPanel from './WithdrawPanel';
import SendPanel from './SendPanel';
import type { Panel, Tab } from '@/lib/dashboardTypes';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

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
  headerActions?: React.ReactNode;
  connectWalletAction?: React.ReactNode;
  /** The user's actual registered profile (from GET /api/users/[pubkey]).
   *  Left undefined until it loads, so Profile falls back to its defaults
   *  rather than flashing a wrong name. */
  username?: string;  
  avatarSrc?: string;
}

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function SavingsDashboard({ publicKey, wallet, onLogout, headerActions, connectWalletAction, username, avatarSrc }: DashboardProps) {
  const router = useRouter();
  const configured = contractConfigured();
  const { showToast } = useToast();
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
  const [transferState, setTransferState] = useState(getTransferState());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trust, setTrust] = useState<TrustScore | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [vaultsCount, setVaultsCount] = useState<number>(0);
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

  // Pending transfer approval — backend-backed, fetched async instead of
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
    try {
      setState(await readSavingsState());
      await loadVaultSummary(publicKey);
      if (publicKey) {
        const balances = await fetchBalances(publicKey);
        setWalletBalances(balances);
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to read contract', 'error');
    } finally {
      setLoading(false);
    }
  }, [configured, loadVaultSummary, publicKey, showToast]);

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
      showToast(e instanceof Error ? e.message : 'Failed to load transfer requests', 'error');
    } finally {
      setPendingLoading(false);
    }
  }, [publicKey, showToast]);

  useEffect(() => {
    if (!publicKey) return;
    authFetch('/api/users/me')
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile ?? null);
        setTrust(d.trust ?? null);
        setPoints(d.points ?? 0);
        setVaultsCount(d.vaultsCount ?? 0);
      })
      .catch(() => {
        setProfile(null);
        setTrust(null);
        setPoints(0);
        setVaultsCount(0);
      });
  }, [publicKey]);

  useEffect(() => {
    if (!configured) return;
    let ignore = false;
    setLoading(true);
    readSavingsState()
      .then((next) => { if (!ignore) setState(next); })
      .catch((e: unknown) => { if (!ignore) showToast(e instanceof Error ? e.message : 'Failed to read contract', 'error'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    queueMicrotask(() => {
      if (!ignore) void loadVaultSummary(publicKey);
    });
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
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) void refreshPendingApproval();
    });
    return () => { ignore = true; };
  }, [refreshPendingApproval]);

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((d) => { if (d?.rates?.PHP) setPhpRate(d.rates.PHP); })
      .catch(() => { });
  }, []);

  useEffect(() => {
  if (!publicKey) return;
  const interval = setInterval(() => {
    fetchBalances(publicKey)
      .then((b) => setWalletBalances(b))
      .catch(() => {});
  }, 20000); // every 20s
  return () => clearInterval(interval);
}, [publicKey]);

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
    setBusy(true);
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
        showToast(`Received ${data.amount} test USDC!`, 'success');
        setPanel(null);
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Deposit failed', 'error');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleWithdraw = async () => {
    showToast('Cashing out is coming soon. Your funds stay safely in your wallet for now.', 'info');
  };

  const handleTransferRequest = async () => {
    if (!publicKey || !recipient || !transferAmount) return;
    setBusy(true);
    try {
      await createPendingTransferApproval(recipient, Number(transferAmount));
      showToast('Transfer request created. The receiver must approve it before it can be sent.', 'success');
      await refreshPendingApproval();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to create transfer request', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAsSender = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey) return;
    setBusy(true);
    try {
      await updatePendingTransferApproval(pendingApproval.id);
      showToast('Sender approval recorded. Waiting for receiver approval.', 'success');
      await refreshPendingApproval();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to approve transfer', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApproveAsReceiver = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.recipient !== publicKey) return;
    setBusy(true);
    try {
      await updatePendingTransferApproval(pendingApproval.id);
      showToast('Receiver approval recorded. The sender can now submit the transfer.', 'success');
      await refreshPendingApproval();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to approve transfer', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitApprovedTransfer = async () => {
    if (!pendingApproval || !publicKey || pendingApproval.sender !== publicKey || !pendingApproval.senderAuthorized || !pendingApproval.receiverAuthorized) return;
    setBusy(true);
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
        showToast('USDC transfer completed successfully!', 'success');
      });
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Transfer failed', 'error');
    } finally {
      setBusy(false);
      resetTransferState();
    }
  };

  const handleVoidPendingApproval = async () => {
    if (!pendingApproval) return;
    setBusy(true);
    try {
      await removePendingTransferApproval(pendingApproval.id);
      await refreshPendingApproval();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to cancel transfer request', 'error');
    } finally {
      setBusy(false);
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
      {activeTab === 'home' && (
        <div className="px-6 pt-7 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {headerActions}
          </div>
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
            onNavigateToTransfer={() => {
              setActiveTab('home');
              setPanel('receive');
            }}
          />
        </div>
      )}

      {activeTab === 'home' && (
        <>
          <div className="mx-6 mt-6 p-6 rounded-3xl bg-linear-to-br from-[#FFB238] via-[#FF9F1C] to-[#F37A00] text-white shadow-[0_18px_30px_-14px_rgba(230,80,0,0.40)] relative overflow-hidden">
            {/* Safe icon artwork, echoing the vault/dial motif */}
            <Image
              src="/safeIcon.png"
              alt=""
              aria-hidden="true"
              width={176}
              height={176}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-40 h-40 object-contain pointer-events-none select-none"
            />

            <div className="space-y-2 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.14em] uppercase font-semibold text-white/80">Total Balance</span>
              </div>

              <div className="flex items-baseline gap-1.5 mt-3">
                <span className="text-lg font-semibold text-white/85">₱</span>
                {loading ? (
                  <h1 className="text-xl font-light text-white/60">Loading…</h1>
                ) : (
                  <h1 className="text-[2.6rem] font-semibold tracking-tight leading-none">
                    {showBalance ? totalEquivalentInPhp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '••••••'}
                  </h1>
                )}
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0 self-center"
                  aria-label="Toggle balance visibility"
                >
                  <EyeIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-xs font-medium tracking-wide text-white/80 flex items-center gap-1.5 pt-1">
                {showBalance ? `≈ ${walletUsdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC` : '•••••• USDC'}
              </span>
            </div>
          </div>

          {/* Spinning Dial Core Wrapper */}
          <div className="mt-25 mb-5">
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
                {(transferState.status !== 'idle') && (
                  <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-1 text-[11px]">
                    <p className="text-slate-400 font-light">{transferState.message}</p>
                  </div>
                )}

                {needsPin && (
                  <PinUnlockPanel
                    pinInput={pinInput}
                    onPinInputChange={setPinInput}
                    pinError={pinError}
                    unlocking={unlocking}
                    onUnlock={handleUnlockAndRetry}
                    onCancel={() => { setNeedsPin(false); setPinInput(''); setPinError(''); setPendingRetry(null); }}
                  />
                )}

                {/* ---------- DEPOSIT & RECEIVE COMBINED CONTAINER ---------- */}
                {(panel === 'deposit' || panel === 'receive') && publicKey && (
                  <DepositReceivePanel
                    panel={panel}
                    setPanel={setPanel}
                    publicKey={publicKey}
                    phpRate={phpRate}
                    busy={busy}
                    loading={loading}
                    depositAmount={depositAmount}
                    onDepositAmountChange={setDepositAmount}
                    onDeposit={handleDeposit}
                    receiveMode={receiveMode}
                    onReceiveModeChange={setReceiveMode}
                    copied={copied}
                    onCopyAddress={handleCopyAddress}
                    receiveRequestAmount={receiveRequestAmount}
                    onReceiveRequestAmountChange={setReceiveRequestAmount}
                    pendingApproval={pendingApproval}
                    onApproveAsReceiver={handleApproveAsReceiver}
                    onVoidPendingApproval={handleVoidPendingApproval}
                  />
                )}

                {/* ---------- WITHDRAW CONTAINER ---------- */}
                {panel === 'withdraw' && (
                  <WithdrawPanel
                    withdrawAmount={withdrawAmount}
                    onWithdrawAmountChange={setWithdrawAmount}
                    busy={busy}
                    usdcBalance={usdcBalance}
                    phpRate={phpRate}
                  />
                )}

                {/* ---------- SEND CONTAINER ---------- */}
                {panel === 'send' && (
                  <SendPanel
                    publicKey={publicKey}
                    sendMode={sendMode}
                    onSendModeChange={setSendMode}
                    pendingApproval={pendingApproval}
                    recipient={recipient}
                    onRecipientChange={setRecipient}
                    transferAmount={transferAmount}
                    onTransferAmountChange={setTransferAmount}
                    busy={busy}
                    onTransferRequest={handleTransferRequest}
                    onApproveAsSender={handleApproveAsSender}
                    onApproveAsReceiver={handleApproveAsReceiver}
                    onSubmitApprovedTransfer={handleSubmitApprovedTransfer}
                    onVoidPendingApproval={handleVoidPendingApproval}
                    needsPin={needsPin}
                    scannedOk={scannedOk}
                    scanError={scanError}
                    onQrScanResult={handleQrScanResult}
                  />
                )}

                {/* ---------- CREATE VAULT CONTAINER ---------- */}
                {panel === 'create' && publicKey && (
                  <div className="rounded-2xl bg-white border border-slate-100 p-2 text-[#1A1A1A] animate-fadeIn">
                    <CreateVault
                      publicKey={publicKey}
                      onCreated={() => {
                        setPanel(null);
                        showToast('Vault initialized.', 'success');
                        void refresh();
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
          <div className="pt-8">
            <History 
              history={history} 
              loading={loading} 
              onRefresh={refresh} 
            />
          </div>
        )}

        {/* === PROFILE VIEW PANEL === */}
        {activeTab === 'profile' && (
          <div className="pt-8">
            <Profile 
              publicKey={publicKey}
              phpRate={phpRate}
              copied={copied}
              purchasingPowerSaved={purchasingPowerSaved}
              onCopyAddress={handleCopyAddress}
              wallet={wallet}
              loading={loading}
              onRefresh={refresh}
              onOpenSettings={() => router.push('/settings')}
              points={points}
              vaultsCount={vaultsCount}
              username={profile?.displayName ?? username}
              avatarSrc={profile?.profilePicture ?? avatarSrc}
              phoneVerified={profile?.phoneVerified}
              phoneNumber={profile?.phoneNumber ?? undefined}
              identityVerified={profile?.alternativeIdVerified}
            />
          </div>
        )}
        
        {/* === VAULT VIEW PANEL === */}
        {activeTab === 'vaults' && (
          <div className="pt-8">
            <Vaults
              publicKey={publicKey}
              loading={loading}
              onWalletChanged={refresh}
              focusVaultId={focusVaultId}
              onFocusHandled={() => setFocusVaultId(null)}
            />
          </div>
        )}

      </div>

      {/* Fixed Floating Dock Menu */}
      <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-4 pt-3 pb-7 flex justify-between items-center z-40">
        {(['home', 'vaults', 'activity', 'profile'] as Tab[]).map((tab) => {
          const isSelected = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPanel(null);
              }}
              className="flex-1 flex items-center justify-center"
            >
              <span
                className={`p-2 rounded-full transition-colors ${
                  isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <NavIcon type={tab} active={isSelected} />
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}