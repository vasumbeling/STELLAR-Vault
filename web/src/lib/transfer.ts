import { StrKey } from '@stellar/stellar-sdk';
import { fetchBalances } from './balances';
import { buildContributeXDR, buildWithdrawXDR } from './contract';
import { buildPaymentXDR, pollTransaction, submitSignedXDR } from './payment';
import { walletService, signWithCurrentAccount, authFetch } from './wallet';
import { recordHistoryEntry } from './history';
import { createAppNotification } from './notifications';

export type TransferOperation = 'deposit' | 'withdraw' | 'transfer';
export type TransferStatus =
  | 'idle'
  | 'validating'
  | 'building'
  | 'waiting_for_signature'
  | 'submitting'
  | 'pending_confirmation'
  | 'confirmed'
  | 'failed';

export interface TransferResult {
  hash: string;
  status: 'confirmed';
  operation: TransferOperation;
  amount: number;
  sender: string;
  recipient: string;
  vaultId?: string;
  confirmedAt: string;
  message: string;
}

export interface TransferState {
  status: TransferStatus;
  operation: TransferOperation | null;
  message: string;
  error: string | null;
  result: TransferResult | null;
}

export interface TransferOptions {
  recipient?: string;
  onCompleted?: () => void | Promise<void>;
}

export interface PendingTransferApproval {
  id: string;
  sender: string;
  recipient: string;
  amount: number;
  senderAuthorized: boolean;
  receiverAuthorized: boolean;
  status: 'awaiting_authorization' | 'ready_to_submit' | 'submitted';
  createdAt: string;
}

const defaultState: TransferState = {
  status: 'idle',
  operation: null,
  message: 'Ready',
  error: null,
  result: null,
};

let currentState: TransferState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(patch: Partial<TransferState>) {
  currentState = {
    ...currentState,
    ...patch,
  };
  emit();
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'The transfer could not be completed.';
}

function normalizeAmount(amount: string | number): number {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Please enter a positive amount.');
  }

  if (!/^(?:\d+)(?:\.\d{1,7})?$/.test(String(amount))) {
    throw new Error('USDC amounts can have up to 7 decimal places.');
  }

  return Number(parsed.toFixed(7));
}

async function validateWalletAndBalance(amount: number, operation: TransferOperation): Promise<string> {
  const wallet = walletService.getSnapshot();
  if (!wallet.isConnected || !wallet.publicKey || !wallet.address) {
    throw new Error('Connect your wallet before attempting a transfer.');
  }

  if (wallet.network !== 'testnet') {
    throw new Error('Please switch your wallet to Testnet to continue.');
  }

  if (!wallet.signerAvailable) {
    throw new Error('The wallet signer is unavailable.');
  }

  if (operation === 'deposit') {
    const balances = await fetchBalances(wallet.publicKey);
    if (Number(balances.usdc) < amount) {
      throw new Error(`Insufficient USDC balance. You only have ${balances.usdc} USDC.`);
    }
  }

  return wallet.publicKey;
}

async function signXdr(xdr: string): Promise<string> {
  return signWithCurrentAccount(xdr);
}

async function submitAndConfirm(signedXdr: string, operation: TransferOperation, vaultId?: string | number): Promise<string> {
  setState({ status: 'submitting', message: 'Broadcasting transaction…' });
  await createAppNotification({
    message: operation === 'deposit'
      ? 'Deposit transaction submitted to the blockchain.'
      : operation === 'withdraw'
        ? 'Withdrawal transaction submitted to the blockchain.'
        : 'Transfer transaction submitted to the blockchain.',
    vaultId: vaultId !== undefined ? String(vaultId) : null,
    variant: 'info',
    meta: { event: 'transaction_submitted', operation, timestamp: new Date().toISOString() },
  }).catch(() => undefined);

  const hash = await submitSignedXDR(signedXdr);
  setState({ status: 'pending_confirmation', message: 'Waiting for confirmation…' });
  await pollTransaction(hash);

  await createAppNotification({
    message: operation === 'deposit'
      ? 'Deposit transaction confirmed on-chain.'
      : operation === 'withdraw'
        ? 'Withdrawal transaction confirmed on-chain.'
        : 'Transfer transaction confirmed on-chain.',
    vaultId: vaultId !== undefined ? String(vaultId) : null,
    variant: 'success',
    meta: { event: 'transaction_confirmed', operation, hash, timestamp: new Date().toISOString() },
  }).catch(() => undefined);

  return hash;
}

async function runTransfer(
  operation: TransferOperation,
  amount: string | number,
  onChainVaultId: string | number | undefined,
  dbVaultId: string | undefined,
  options: TransferOptions = {},
): Promise<TransferResult> {
  const normalizedAmount = normalizeAmount(amount);
  setState({
    status: 'validating',
    operation,
    message: 'Validating transfer request…',
    error: null,
    result: null,
  });

  try {
    const sender = await validateWalletAndBalance(normalizedAmount, operation);
    let xdr: string;

    if (operation === 'deposit') {
      setState({ status: 'building', message: 'Building deposit transaction…' });
      xdr = await buildContributeXDR(sender, normalizedAmount, onChainVaultId);
    } else if (operation === 'withdraw') {
      setState({ status: 'building', message: 'Building withdrawal transaction…' });
      xdr = await buildWithdrawXDR(sender, normalizedAmount, onChainVaultId);
    } else {
      if (!options.recipient || !StrKey.isValidEd25519PublicKey(options.recipient)) {
        throw new Error('Please provide a valid Stellar recipient address.');
      }

      setState({ status: 'building', message: 'Building payment transaction…' });
      xdr = await buildPaymentXDR(sender, options.recipient, normalizedAmount.toFixed(7), 'USDC');
    }

    setState({ status: 'waiting_for_signature', message: 'Waiting for wallet approval…' });
    const signedXdr = await signXdr(xdr);
    const hash = await submitAndConfirm(signedXdr, operation, onChainVaultId);

    if (operation === 'deposit' || operation === 'withdraw') {
      const eventRes = await authFetch(`/api/vaults/${String(dbVaultId)}/events`, {
        method: 'POST',
        body: JSON.stringify({
          eventType: operation === 'deposit' ? 'deposit' : 'withdraw',
          amount: normalizedAmount,
          ...(operation === 'withdraw' ? { recipient: sender } : {}),
        }),
      });
      const eventData = await eventRes.json().catch(() => null);
      if (!eventRes.ok) {
        throw new Error(eventData?.error ?? 'Vault update failed after the transaction confirmed.');
      }
    }

    const result: TransferResult = {
      hash,
      status: 'confirmed',
      operation,
      amount: normalizedAmount,
      sender,
      recipient: operation === 'transfer' ? options.recipient ?? '' : 'vault',
      vaultId: operation === 'transfer' ? undefined : dbVaultId,
      confirmedAt: new Date().toISOString(),
      message: operation === 'deposit'
        ? 'Deposit completed successfully.'
        : operation === 'withdraw'
          ? 'Withdrawal completed successfully.'
          : 'USDC transfer completed successfully.',
    };

    setState({ status: 'confirmed', message: result.message, error: null, result });

    recordHistoryEntry({
      account: sender,
      kind: operation === 'deposit' ? 'deposit' : operation === 'withdraw' ? 'withdraw' : 'send',
      title: operation === 'deposit' ? 'Vault deposit' : operation === 'withdraw' ? 'Vault withdrawal' : 'USDC sent',
      description: operation === 'deposit'
        ? `Saved ${normalizedAmount.toFixed(7)} USDC into the vault`
        : operation === 'withdraw'
          ? `Withdrew ${normalizedAmount.toFixed(7)} USDC from the vault`
          : `Sent ${normalizedAmount.toFixed(7)} USDC to ${options.recipient ?? ''}`,
      amount: normalizedAmount,
      asset: 'USDC',
      counterparty: operation === 'transfer' ? options.recipient ?? '' : 'vault',
      timestamp: new Date().toISOString(),
      source: 'local',
      hash,
      status: 'confirmed',
    });

    if (options.onCompleted) {
      await options.onCompleted();
    }
    return result;
  } catch (error) {
    const message = formatError(error);
    await createAppNotification({
      message: operation === 'deposit'
        ? `Deposit failed: ${message}`
        : operation === 'withdraw'
          ? `Withdrawal failed: ${message}`
          : `Transfer failed: ${message}`,
      vaultId: dbVaultId ?? null,
      variant: 'error',
      meta: { event: 'transaction_failed', operation, error: message, timestamp: new Date().toISOString() },
    }).catch(() => undefined);
    setState({ status: 'failed', message, error: message, result: null });
    throw new Error(message);
  }
}

export async function depositUSDC(
  amount: string | number,
  onChainVaultId: string | number,
  dbVaultId: string,
  options: TransferOptions = {},
): Promise<TransferResult> {
  return runTransfer('deposit', amount, onChainVaultId, dbVaultId, options);
}

export async function withdrawUSDC(
  amount: string | number,
  onChainVaultId: string | number,
  dbVaultId: string,
  options: TransferOptions = {},
): Promise<TransferResult> {
  return runTransfer('withdraw', amount, onChainVaultId, dbVaultId, options);
}

export async function transferUSDC(
  recipient: string,
  amount: string | number,
  options: Omit<TransferOptions, 'recipient'> = {},
): Promise<TransferResult> {
  return runTransfer('transfer', amount, undefined, undefined, { ...options, recipient });
}

export function getTransferState(): TransferState {
  return { ...currentState };
}

export function subscribeToTransferState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetTransferState() {
  currentState = { ...defaultState };
  emit();
}

/* ---------------------------------------------------------------------- */
/* Pending transfer approvals — now backend-backed via /api/transfers,    */
/* not localStorage. Sender/receiver identity is derived server-side from */
/* the auth token, not trusted from the client.                          */
/* ---------------------------------------------------------------------- */

export async function createPendingTransferApproval(
  recipientPubkey: string,
  amount: number,
): Promise<PendingTransferApproval> {
  const res = await authFetch('/api/transfers', {
    method: 'POST',
    body: JSON.stringify({ recipientPubkey, amount }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Failed to create transfer request.');
  }
  return normalizeTransfer(data);
}

export async function getPendingTransferApprovalsForAddress(): Promise<PendingTransferApproval[]> {
  const res = await authFetch('/api/transfers');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Failed to load transfer requests.');
  }
  return (data.transfers ?? []).map(normalizeTransfer);
}

export async function updatePendingTransferApproval(id: string): Promise<PendingTransferApproval> {
  const res = await authFetch(`/api/transfers/${id}`, { method: 'PATCH' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? 'Failed to update transfer request.');
  }
  return normalizeTransfer(data);
}

export async function removePendingTransferApproval(id: string): Promise<void> {
  const res = await authFetch(`/api/transfers/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error ?? 'Failed to cancel transfer request.');
  }
}

function normalizeTransfer(raw: {
  id: string;
  senderPubkey: string;
  recipientPubkey: string;
  amount: number;
  senderAuthorized: boolean;
  receiverAuthorized: boolean;
  status: string;
  createdAt: string;
}): PendingTransferApproval {
  return {
    id: raw.id,
    sender: raw.senderPubkey,
    recipient: raw.recipientPubkey,
    amount: raw.amount,
    senderAuthorized: raw.senderAuthorized,
    receiverAuthorized: raw.receiverAuthorized,
    status: raw.status as PendingTransferApproval['status'],
    createdAt: raw.createdAt,
  };
}