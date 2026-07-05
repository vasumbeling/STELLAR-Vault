// lib/wallet.ts

import { generateKeypair, keypairFromSecret, fundTestnetAccount, NETWORK_PASSPHRASE } from '@/lib/stellar';
import { encryptSecretKey, decryptSecretKey } from '@/lib/auth/encryption';
import { saveAccount, loadAccount } from '@/lib/auth/storage';
import { TransactionBuilder } from '@stellar/stellar-sdk';

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
  authToken: string | null; // NEW — backend JWT, once authenticated
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
  authToken: null,
};

let currentSnapshot: WalletSnapshot = { ...defaultSnapshot };
// Kept in memory ONLY — never persisted to localStorage. Cleared on disconnect.
// Lets other components (e.g. CreateVault) sign transactions with the active
// PIN account without re-prompting for the PIN on every action.
let currentSecretKey: string | null = null;
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
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<WalletSnapshot>;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: WalletSnapshot) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function clearStoredSnapshot() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function normalizeNetwork(value: string | null | undefined): WalletNetwork {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized.includes('test')) return 'testnet';
  return 'public';
}

function extractAddress(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
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

/* ---------------------------------------------------------------------- */
/* NEW — Backend authentication (challenge → sign → verify)               */
/* ---------------------------------------------------------------------- */

async function requestChallenge(pubkey: string): Promise<string> {
  const res = await fetch('/api/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Failed to get auth challenge from server.');
  }
  return data.challenge as string;
}

async function verifyChallenge(pubkey: string, signature: string, isFreighter = false): Promise<string> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey, signature, isFreighter }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Server rejected the signed challenge.');
  }
  return data.token as string;
}
/**
 * Ensures a User row exists in the backend for this pubkey.
 * Safe to call on every successful auth (register or login) — upserts.
 */
async function ensureUserExists(pubkey: string, username?: string): Promise<void> {
  try {
    await authFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ pubkey, ...(username && { username }) }),
    });
  } catch (error) {
    // Don't block login/registration if this fails — log it, but the
    // JWT is still valid. Worth surfacing during testing though.
    console.error('Failed to sync user record with backend:', error);
  }
}

/** Authenticate using a raw secret key (PIN-account path). Returns the JWT. */
async function authenticateWithSecretKey(secretKey: string): Promise<string> {
  const keypair = keypairFromSecret(secretKey);
  const pubkey = keypair.publicKey();

  const challenge = await requestChallenge(pubkey);
  const signatureBuffer = keypair.sign(Buffer.from(challenge, 'utf8'));
  const signature = signatureBuffer.toString('base64');

  return verifyChallenge(pubkey, signature);
}

/** Authenticate using Freighter's message-signing API. Returns the JWT. */
async function authenticateWithFreighter(address: string): Promise<string> {
  const freighter = await getFreighter();

  if (typeof freighter.signMessage !== 'function') {
    throw new Error(
      'This version of Freighter does not support message signing. Update the extension and try again.',
    );
  }

  const challenge = await requestChallenge(address);

  const result = await freighter.signMessage(challenge, { address });
  if (result?.error) {
    throw new Error(
      typeof result.error === 'string' ? result.error : 'Freighter rejected the sign request.',
    );
  }

  // Freighter returns the signature base64-encoded already.
  const signature = result.signedMessage as string;
  if (!signature) {
    throw new Error('Freighter did not return a signature.');
  }

  return verifyChallenge(address, signature, true);
}

/**
 * Fetch wrapper that automatically attaches the stored backend JWT.
 * Use this for all future calls to /api/vaults, /api/notifications, etc.
 */
export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = currentSnapshot.authToken;
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, { ...options, headers });

  // Token expired or invalid — clear it so the UI can prompt re-auth.
  if (res.status === 401) {
    setSnapshot({ authToken: null });
    persistSnapshot(currentSnapshot);
  }

  return res;
}
/**
 * Signs an XDR transaction using whichever signer is actually active —
 * the in-memory PIN account secret key, or Freighter — instead of assuming
 * Freighter unconditionally. Fixes a bug where PIN-account users' transactions
 * were being (incorrectly) signed by a completely different Freighter account.
 */
export async function signWithCurrentAccount(xdr: string): Promise<string> {
  if (currentSnapshot.provider === 'passkey') {
    if (!currentSecretKey) {
      throw new Error('Your session key is unavailable. Please unlock your account again.');
    }
    const keypair = keypairFromSecret(currentSecretKey);
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);
    return tx.toXDR();
  }

  if (currentSnapshot.provider === 'freighter') {
    const freighter = await import('@stellar/freighter-api');
    const signed = await freighter.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address: currentSnapshot.address ?? undefined,
    });
    if (signed.error) {
      throw new Error(
        typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
      );
    }
    return signed.signedTxXdr;
  }

  throw new Error('No wallet is connected. Please log in and try again.');
}

/* ---------------------------------------------------------------------- */

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
      authToken: persisted.authToken ?? null, // carry over existing JWT if still valid
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
      authToken: null,
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

    // NEW — authenticate with the backend right after connecting.
    const token = await authenticateWithFreighter(address);

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
      authToken: token,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    await ensureUserExists(address); // NEW

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
      authToken: null,
    });
  }
}

async function disconnectWallet(): Promise<void> {
  if (currentSnapshot.status === 'disconnecting') {
    return;
  }

  setSnapshot({ status: 'disconnecting', error: null });
  currentSecretKey = null;
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

/* ---------------------------------------------------------------------- */
/* PIN account creation / unlock                                          */
/* ---------------------------------------------------------------------- */

/** Creates a new PIN-protected account and authenticates it. Returns the new public key. */
export async function createPinAccount(pin: string): Promise<string> {
  setSnapshot({ status: 'connecting', error: null });

  try {
    const { publicKey, secretKey } = generateKeypair();
    currentSecretKey = secretKey;
    const encryptedData = await encryptSecretKey(secretKey, pin);

    // Save encrypted keypair locally
    saveAccount({ publicKey, ...encryptedData });

    // Fund on testnet — remove for mainnet
    await fundTestnetAccount(publicKey);

    // NEW — authenticate with the backend using the freshly generated secret key.
    const token = await authenticateWithSecretKey(secretKey);

    const nextSnapshot: WalletSnapshot = {
      address: publicKey,
      publicKey,
      network: 'testnet',
      provider: 'passkey', // reusing existing provider slot
      signerAvailable: true,
      status: 'ready',
      initialized: true,
      error: null,
      isConnected: true,
      authToken: token,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    await ensureUserExists(publicKey); // NEW

    return publicKey;

    return publicKey; // FIX: caller (CreateAccount.tsx) needs this back
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
      authToken: null,
    });
    throw error; // FIX: rethrow so callers' try/catch actually fires
  }
}

/** Unlocks an existing PIN account and authenticates it. Throws on wrong PIN. */
export async function unlockPinAccount(pin: string): Promise<void> {
  setSnapshot({ status: 'connecting', error: null });

  try {
    const stored = loadAccount();
    if (!stored) throw new Error('No account found. Please create one first.');

    // This throws 'Incorrect PIN' if pin is wrong
    const secretKey = await decryptSecretKey(stored, pin);
    currentSecretKey = secretKey;

    // NEW — authenticate with the backend using the decrypted secret key.
    const token = await authenticateWithSecretKey(secretKey);

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
      authToken: token,
    };

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    currentSnapshot = nextSnapshot;
    persistSnapshot(nextSnapshot);
    emit();

    await ensureUserExists(stored.publicKey); // NEW

  } catch (error) {
    setSnapshot({
      status: 'error',
      error: getErrorMessage(error),
      authToken: null,
    });
    throw error; // FIX: this was missing — wrong PINs were silently succeeding
  }
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
      authToken: persisted.authToken ?? null,
    };
    emit();
  }

  void reconnectWithStoredSession();
}