export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'error'
  | 'disconnecting';

export type WalletProvider = 'freighter' | 'passkey' | 'unknown';
export type WalletNetwork = 'testnet' | 'public' | 'unknown';

export interface WalletSnapshot {
  address: string | null;
  publicKey: string | null;
  network: WalletNetwork;
  provider: WalletProvider;
  signerAvailable: boolean;
  status: WalletStatus;
  initialized: boolean;
  error: string | null;
  isConnected: boolean;
}

const STORAGE_KEY = 'stella-vault.wallet';
const TIMEOUT_MS = 4000;

const defaultSnapshot: WalletSnapshot = {
  address: null,
  publicKey: null,
  network: 'unknown',
  provider: 'unknown',
  signerAvailable: false,
  status: 'disconnected',
  initialized: false,
  error: null,
  isConnected: false,
};

let currentSnapshot: WalletSnapshot = { ...defaultSnapshot };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(patch: Partial<WalletSnapshot> | ((prev: WalletSnapshot) => Partial<WalletSnapshot>)) {
  const nextPatch = typeof patch === 'function' ? patch(currentSnapshot) : patch;
  currentSnapshot = {
    ...currentSnapshot,
    ...nextPatch,
  };
  emit();
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Wallet connection failed. Please try again.';
}

function readStoredSnapshot(): Partial<WalletSnapshot> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<WalletSnapshot>;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: WalletSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function clearStoredSnapshot() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

function normalizeNetwork(value: string | null | undefined): WalletNetwork {
  if (!value) {
    return 'unknown';
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('test')) {
    return 'testnet';
  }

  return 'public';
}

function extractAddress(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const candidate = result as Record<string, unknown>;
  return (
    (candidate.address as string | undefined) ??
    (candidate.publicKey as string | undefined) ??
    (candidate.publicAddress as string | undefined) ??
    null
  );
}

async function getFreighter() {
  return import('@stellar/freighter-api');
}

async function detectNetwork(freighter: Record<string, unknown>): Promise<WalletNetwork> {
  const result = await withTimeout(
    Promise.resolve(
      typeof freighter.getNetwork === 'function'
        ? freighter.getNetwork()
        : Promise.resolve(null),
    ),
    null,
  );

  if (typeof result === 'string') {
    return normalizeNetwork(result);
  }

  if (result && typeof result === 'object') {
    const candidate = result as Record<string, unknown>;
    return normalizeNetwork(
      (candidate.network as string | undefined) ??
        (candidate.name as string | undefined) ??
        (candidate.value as string | undefined) ??
        null,
    );
  }

  return 'unknown';
}

async function reconnectWithStoredSession(): Promise<void> {
  const persisted = readStoredSnapshot();
  if (!persisted?.address) {
    return;
  }

  // If last session was PIN-based, restore silently (no re-auth needed)
  if (persisted.provider === 'passkey') {
    const stored = loadAccount();
    if (stored?.publicKey === persisted.address) {
      currentSnapshot = {
        ...currentSnapshot,
        ...persisted,
        status: 'ready',
        initialized: true,
        error: null,
        isConnected: true,
      };
      emit();
      return; // skip Freighter reconnect
    }
  }

  setSnapshot({ status: 'connecting', error: null });

  try {
    const freighter = await getFreighter();
    const isConnected = await withTimeout(
      Promise.resolve(typeof freighter.isConnected === 'function' ? freighter.isConnected() : false),
      false,
    );

    if (!isConnected) {
      throw new Error('Freighter is not available right now.');
    }

    const network = await detectNetwork(freighter as Record<string, unknown>);
    if (network !== 'testnet') {
      throw new Error('Please switch your wallet to Testnet to continue.');
    }

    const nextSnapshot: WalletSnapshot = {
      ...currentSnapshot,
      address: persisted.address ?? null,
      publicKey: persisted.address ?? null,
      network,
      provider: 'freighter',
      signerAvailable: Boolean(persisted.address),
      status: 'ready',
      initialized: true,
      error: null,
      isConnected: true,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();
  } catch (error) {
    clearStoredSnapshot();
    setSnapshot({
      address: null,
      publicKey: null,
      network: 'unknown',
      provider: 'unknown',
      signerAvailable: false,
      status: 'error',
      initialized: false,
      error: getErrorMessage(error),
      isConnected: false,
    });
  }
}

async function connectWallet(): Promise<void> {
  if (currentSnapshot.status === 'connecting' || currentSnapshot.status === 'initializing' || currentSnapshot.status === 'disconnecting') {
    return;
  }

  setSnapshot({ status: 'connecting', error: null });

  try {
    const freighter = await getFreighter();
    const isConnected = await withTimeout(
      Promise.resolve(typeof freighter.isConnected === 'function' ? freighter.isConnected() : false),
      false,
    );

    if (!isConnected) {
      throw new Error('Freighter is not installed or not available. Install it and reload the page.');
    }

    setSnapshot({ status: 'initializing' });

    const result = await withTimeout(
      Promise.resolve(
        typeof freighter.requestAccess === 'function'
          ? freighter.requestAccess()
          : null,
      ),
      null,
    );

    const address = extractAddress(result);
    if (!address) {
      throw new Error('No Stellar address was returned. Please approve the request in Freighter.');
    }

    const network = await detectNetwork(freighter as Record<string, unknown>);
    if (network !== 'testnet') {
      throw new Error('Please switch your wallet to Testnet before continuing.');
    }

    const nextSnapshot: WalletSnapshot = {
      address,
      publicKey: address,
      network,
      provider: 'freighter',
      signerAvailable: true,
      status: 'ready',
      initialized: true,
      error: null,
      isConnected: true,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();
  } catch (error) {
    clearStoredSnapshot();
    setSnapshot({
      address: null,
      publicKey: null,
      network: 'unknown',
      provider: 'unknown',
      signerAvailable: false,
      status: 'error',
      initialized: false,
      error: getErrorMessage(error),
      isConnected: false,
    });
  }
}

async function disconnectWallet(): Promise<void> {
  if (currentSnapshot.status === 'disconnecting') {
    return;
  }

  setSnapshot({ status: 'disconnecting', error: null });
  clearStoredSnapshot();
  currentSnapshot = { ...defaultSnapshot };
  emit();
}

function clearError() {
  setSnapshot({ error: null });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): WalletSnapshot {
  return { ...currentSnapshot };
}

export const walletService = {
  connect: connectWallet,
  disconnect: disconnectWallet,
  reconnect: reconnectWithStoredSession,
  clearError,
  subscribe,
  getSnapshot,
  createPinAccount,                 
  unlockPinAccount,
};

if (typeof window !== 'undefined') {
  const persisted = readStoredSnapshot();
  if (persisted?.address) {
    currentSnapshot = {
      ...currentSnapshot,
      address: persisted.address ?? null,
      publicKey: persisted.address ?? null,
      network: persisted.network ?? 'unknown',
      provider: persisted.provider ?? 'unknown',
      signerAvailable: Boolean(persisted.address),
      initialized: Boolean(persisted.initialized),
      error: null,
      isConnected: Boolean(persisted.isConnected),
    };
    emit();
  }

  void reconnectWithStoredSession();
}

// lib/wallet.ts — add below the existing walletService

import { generateKeypair, keypairFromSecret, fundTestnetAccount } from '@/lib/stellar';
import { encryptSecretKey, decryptSecretKey } from '@/lib/auth/encryption';
import { saveAccount, loadAccount } from '@/lib/auth/storage';

export async function createPinAccount(pin: string): Promise<void> {
  setSnapshot({ status: 'connecting', error: null });

  try {
    const { publicKey, secretKey } = generateKeypair();
    const encryptedData = await encryptSecretKey(secretKey, pin);
    
    // Save encrypted keypair locally
    saveAccount({ publicKey, ...encryptedData });

    // Fund on testnet — remove for mainnet
    await fundTestnetAccount(publicKey);

    const nextSnapshot: WalletSnapshot = {
      address: publicKey,
      publicKey,
      network: 'testnet',
      provider: 'passkey',       // reusing existing provider slot
      signerAvailable: true,
      status: 'ready',
      initialized: true,
      error: null,
      isConnected: true,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();
  } catch (error) {
    clearStoredSnapshot();
    setSnapshot({
      address: null,
      publicKey: null,
      network: 'unknown',
      provider: 'unknown',
      signerAvailable: false,
      status: 'error',
      initialized: false,
      error: getErrorMessage(error),
      isConnected: false,
    });
  }
}

export async function unlockPinAccount(pin: string): Promise<void> {
  setSnapshot({ status: 'connecting', error: null });

  try {
    const stored = loadAccount();
    if (!stored) throw new Error('No account found. Please create one first.');

    // This throws 'Incorrect PIN' if pin is wrong
    await decryptSecretKey(stored, pin);

    const nextSnapshot: WalletSnapshot = {
      address: stored.publicKey,
      publicKey: stored.publicKey,
      network: 'testnet',
      provider: 'passkey',
      signerAvailable: true,
      status: 'ready',
      initialized: true,
      error: null,
      isConnected: true,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();
  } catch (error) {
    setSnapshot({
      status: 'error',
      error: getErrorMessage(error),
    });
    throw error; // rethrow so callers (e.g. PinEntry) know the unlock failed
  }
}