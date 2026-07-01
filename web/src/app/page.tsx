'use client';
import { useState, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import ConnectWallet from '@/components/ConnectWallet';
import FundAccount from '@/components/FundAccount';
import AddTrustline from '@/components/AddTrustline';
import SavingsDashboard from '@/components/SavingsDashboard';

export default function Home() {
  const wallet = useWallet();
  const { publicKey, connecting, status, network, provider, signerAvailable, error } = wallet;
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <main className="min-h-screen w-full bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stella Vault</h1>
            <p className="text-sm text-gray-500">Wallet · payments · Soroban — testnet</p>
          </div>
          <ConnectWallet {...wallet} />
        </header>

        <section className="mb-6 rounded border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Wallet</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase tracking-wide text-gray-700">
              {status}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <div>
              <span className="text-gray-500">Address</span>
              <p className="font-mono text-xs text-gray-800">{publicKey ? `${publicKey.slice(0, 12)}…${publicKey.slice(-6)}` : 'Not connected'}</p>
            </div>
            <div>
              <span className="text-gray-500">Network</span>
              <p className="text-gray-800">{network}</p>
            </div>
            <div>
              <span className="text-gray-500">Provider</span>
              <p className="text-gray-800">{provider}</p>
            </div>
            <div>
              <span className="text-gray-500">Signer</span>
              <p className="text-gray-800">{signerAvailable ? 'Available' : 'Unavailable'}</p>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </section>

        {!publicKey && !connecting && (
          <div className="rounded border border-gray-200 bg-white py-16 text-center text-gray-500">
            <p className="mb-2">Connect your Freighter wallet to get started.</p>
            <p className="text-sm">
              No wallet?{' '}
              <a
                href="https://freighter.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Install Freighter
              </a>{' '}
              and switch it to Test Net.
            </p>
          </div>
        )}

        {publicKey && (
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <FundAccount publicKey={publicKey} onFunded={refresh} />
            <AddTrustline publicKey={publicKey} onDone={refresh} />
          </div>
        )}

        <SavingsDashboard publicKey={publicKey} />

        <footer className="mt-10 text-center text-xs text-gray-400">
          Built for the StellarX PH workshop @ PUP QC · pick an idea, then bend this scaffold toward it.
        </footer>
      </div>
    </main>
  );
}
