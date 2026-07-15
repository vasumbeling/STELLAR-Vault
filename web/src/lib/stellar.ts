import { rpc, Networks, Asset } from '@stellar/stellar-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import StellarHDWallet from 'stellar-hd-wallet';

// Network passphrase comes from the SDK constant, NOT a hardcoded string —
// a wrong passphrase shows up as a misleading `tx_bad_auth` error.
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
export const DEFAULT_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const USDC_ISSUER = process.env.NEXT_PUBLIC_USDC_ISSUER ?? DEFAULT_USDC_ISSUER;
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';

// v15 SDK: use the `rpc` namespace (the old `SorobanRpc` namespace is gone).
export const server = new rpc.Server(RPC_URL);
export const XLM = Asset.native();
export const USDC = USDC_ISSUER ? new Asset('USDC', USDC_ISSUER) : null;
export const USDC_CONTRACT_ID = USDC ? USDC.contractId(NETWORK_PASSPHRASE) : '';

/** Fund a testnet account via Friendbot (~10,000 XLM). */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  // 400 usually means "account already funded" — not a real failure for our flow.
  if (!res.ok && res.status !== 400) {
    throw new Error('Friendbot funding failed. Try again in a moment.');
  }
}

/**
 * Generate a brand new Stellar keypair backed by a real BIP-39 mnemonic,
 * derived via SEP-0005 (m/44'/148'/0'). The returned mnemonic is the only
 * way to recover this account later — callers must show it to the user
 * once and must never persist it (localStorage, network, logs, etc).
 */
export function generateKeypair() {
  const mnemonic = StellarHDWallet.generateMnemonic(); // 24 words, BIP-39
  const wallet = StellarHDWallet.fromMnemonic(mnemonic);
  return {
    publicKey: wallet.getPublicKey(0),
    secretKey: wallet.getSecret(0),
    mnemonic,
  };
}

/**
 * Re-derive the same keypair (account index 0) from a previously generated
 * recovery phrase. Used by the /recover flow — the mnemonic should only
 * ever live in memory for the duration of this call.
 */
export function keypairFromMnemonic(mnemonic: string) {
  const wallet = StellarHDWallet.fromMnemonic(mnemonic.trim());
  return {
    publicKey: wallet.getPublicKey(0),
    secretKey: wallet.getSecret(0),
  };
}

/** Restore a keypair from a secret key */
export function keypairFromSecret(secretKey: string) {
  return Keypair.fromSecret(secretKey);
}