// hooks/useAuth.ts
'use client';
import { useState } from 'react';
import { generateKeypair, keypairFromSecret, fundTestnetAccount } from '@/lib/stellar';
import { encryptSecretKey, decryptSecretKey } from '@/lib/auth/encryption';
import { saveAccount, loadAccount, hasAccount } from '@/lib/auth/storage';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAccount(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const { publicKey, secretKey } = generateKeypair();
      const encryptedData = await encryptSecretKey(secretKey, pin);
      saveAccount({ publicKey, ...encryptedData });
      await fundTestnetAccount(publicKey); // remove on mainnet
      return publicKey;
    } catch (e) {
      setError('Account creation failed. Try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function unlockAccount(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const stored = loadAccount();
      if (!stored) throw new Error('No account found');
      const secretKey = await decryptSecretKey(stored, pin);
      return keypairFromSecret(secretKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock');
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { createAccount, unlockAccount, loading, error, hasAccount };
}