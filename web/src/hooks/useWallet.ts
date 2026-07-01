'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { walletService, type WalletSnapshot, type WalletStatus } from '@/lib/wallet';

export interface WalletState extends WalletSnapshot {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  clearError: () => void;
  connecting: boolean;
  ready: boolean;
  isInitializing: boolean;
}

export function useWallet(): WalletState {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>({
    address: null,
    publicKey: null,
    network: 'unknown',
    provider: 'unknown',
    signerAvailable: false,
    status: 'disconnected',
    initialized: false,
    error: null,
    isConnected: false,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSnapshot(walletService.getSnapshot());
    setHydrated(true);

    return walletService.subscribe(() => {
      setSnapshot(walletService.getSnapshot());
    });
  }, []);

  const connect = useCallback(async () => {
    await walletService.connect();
  }, []);

  const disconnect = useCallback(async () => {
    await walletService.disconnect();
  }, []);

  const reconnect = useCallback(async () => {
    await walletService.reconnect();
  }, []);

  const clearError = useCallback(() => {
    walletService.clearError();
  }, []);

  const isConnecting = hydrated && (snapshot.status === 'connecting' || snapshot.status === 'initializing');
  const isDisconnecting = hydrated && snapshot.status === 'disconnecting';

  return useMemo(
    () => ({
      ...snapshot,
      connect,
      disconnect,
      reconnect,
      clearError,
      connecting: isConnecting,
      ready: hydrated && snapshot.status === 'ready',
      isInitializing: hydrated && (snapshot.status === 'initializing' || isDisconnecting),
    }),
    [snapshot, connect, disconnect, reconnect, clearError, isConnecting, isDisconnecting, hydrated],
  );
}
