'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import type { UserProfile, TrustScore } from '@/lib/auth/verification';
import { EyeIcon, SparkleStar, NavIcon } from '@/app/icons';

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
}

const SESSION_KEY_MISSING_MESSAGE = 'Your session key is unavailable. Please unlock your account again.';

export default function SavingsDashboard({ publicKey, wallet, onLogout, headerActions }: DashboardProps) {
  const router = useRouter();
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

  const handleVoidPendingApproval = async () => {
    if (!pendingApproval) return;
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
        <div className="px-6 pt-7 flex justify-between items-center">
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
          />
        </div>
      )}

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
              username={profile?.displayName ?? undefined}
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