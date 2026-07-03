'use client';

import type { WalletState } from '@/hooks/useWallet';

export default function ConnectWallet(wallet: WalletState) {
  const { publicKey, connecting, connect, disconnect } = wallet;

  // 1. Connected State (Minimal, Single Row Button Actions)
  if (publicKey) {
    return (
      <div className="flex items-center gap-2">
        <button 
          onClick={() => void disconnect()} 
          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-[#FF4E00] text-[11px] font-bold text-slate-500 transition-colors cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // 2. Disconnected/Connecting State (Clean, Low-Profile Cyan Button)
  return (
    <button
      onClick={() => void connect()}
      disabled={connecting}
      className="inline-flex items-center justify-center rounded-full bg-[#EAFEFE] border border-[#BCEFEF] px-4 py-1.5 text-xs font-black text-[#0A4B4E] hover:bg-[#D4FAFA] transition-all active:scale-[0.97] disabled:opacity-50 cursor-pointer"
    >
      {connecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}