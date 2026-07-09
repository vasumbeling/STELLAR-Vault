import { Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL } from './stellar';

export type HistoryKind = 'deposit' | 'withdraw' | 'send' | 'receive' | 'other';

export interface HistoryEntry {
  id: string;
  account: string;
  kind: HistoryKind;
  title: string;
  description: string;
  amount: number;
  asset: 'USDC' | 'XLM' | 'unknown';
  counterparty: string;
  timestamp: string;
  source: 'local' | 'horizon';
  hash?: string;
  status: 'confirmed' | 'pending' | 'failed';
}

const storageKey = 'stella-vault.transaction-history';

function readStoredHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(entries));
}

function normalizeAmount(value: string | number | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type StellarOperationLike = {
  id?: string | number;
  type?: string;
  to?: string;
  from?: string;
  amount?: string | number;
  asset_code?: string;
  asset_type?: string;
  created_at?: string;
  transaction_hash?: string;
};

function mapPaymentOperation(operation: StellarOperationLike, account: string): HistoryEntry | null {
  const isIncoming = operation.to === account;
  const kind: HistoryKind = isIncoming ? 'receive' : 'send';
  const assetCode = operation.asset_code ?? (operation.asset_type === 'native' ? 'XLM' : 'unknown');
  const amount = normalizeAmount(operation.amount);

  if (!operation.from || !operation.to) {
    return null;
  }

  return {
    id: `${operation.id}-${kind}`,
    account,
    kind,
    title: isIncoming ? 'Received payment' : 'Sent payment',
    description: `${isIncoming ? 'Received from' : 'Sent to'} ${isIncoming ? operation.from : operation.to}`,
    amount,
    asset: assetCode === 'USDC' ? 'USDC' : assetCode === 'XLM' ? 'XLM' : 'unknown',
    counterparty: isIncoming ? operation.from : operation.to,
    timestamp: operation.created_at ?? new Date().toISOString(),
    source: 'horizon',
    status: 'confirmed',
    hash: operation.transaction_hash,
  };
}

export function recordHistoryEntry(entry: Omit<HistoryEntry, 'id'> & { id?: string }) {
  const normalized: HistoryEntry = {
    id: entry.id ?? `${Date.now()}-${Math.random()}`,
    ...entry,
  };

  const next = [normalized, ...readStoredHistory().filter((item) => item.id !== normalized.id)].slice(0, 100);
  writeStoredHistory(next);
  return normalized;
}

export async function loadHistory(account: string | null | undefined): Promise<HistoryEntry[]> {
  if (!account) {
    return [];
  }

  const localEntries = readStoredHistory().filter((entry) => entry.account === account);

  try {
    const horizon = new Horizon.Server(HORIZON_URL);
    const operations = await horizon.operations().forAccount(account).order('desc').limit(10).call();
    const horizonEntries = operations.records
      .filter((operation) => operation.type === 'payment')
      .map((operation) => mapPaymentOperation(operation as StellarOperationLike, account))
      .filter((entry): entry is HistoryEntry => Boolean(entry));

    const merged = [...localEntries, ...horizonEntries];

    // Prefer the local entry when a transaction hash appears in both — it has
    // richer context (vault names, etc.) than what Horizon alone can tell us.
    const seenHashes = new Set<string>();
    const deduped: HistoryEntry[] = [];
    for (const entry of merged) {
      const dedupeKey = entry.hash ?? entry.id;
      if (seenHashes.has(dedupeKey)) {
        continue;
      }
      seenHashes.add(dedupeKey);
      deduped.push(entry);
    }

    return deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);
  } catch {
    return localEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12);
  }
}