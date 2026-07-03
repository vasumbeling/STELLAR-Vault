const ACCOUNT_KEY = 'stella_vault_account';

export interface StoredAccount {
  publicKey: string;
  encrypted: string;
  salt: string;
  iv: string;
}

export function saveAccount(account: StoredAccount): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function loadAccount(): StoredAccount | null {
  const raw = localStorage.getItem(ACCOUNT_KEY);
  return raw ? (JSON.parse(raw) as StoredAccount) : null;
}

export function clearAccount() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCOUNT_KEY);
}

export function hasAccount(): boolean {
  return localStorage.getItem(ACCOUNT_KEY) !== null;
}