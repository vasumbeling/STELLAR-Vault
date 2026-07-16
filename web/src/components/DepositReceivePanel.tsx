'use client';

import QRCodeDisplay from './QRCodeDisplay';
import type { Panel } from './dashboardTypes';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

/** Builds a `stellar:` payment URI so scanning apps can prefill destination + amount. */
function buildPaymentUri(address: string, amount?: string): string {
  if (!amount || Number(amount) <= 0) return address;
  return `stellar:${address}?amount=${encodeURIComponent(amount)}`;
}

function QrCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h6v-6h-3" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15V5a2 2 0 012-2h10" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function DepositReceivePanel({
  panel,
  setPanel,
  publicKey,
  phpRate,
  busy,
  loading,
  depositAmount,
  onDepositAmountChange,
  onDeposit,
  receiveMode,
  onReceiveModeChange,
  copied,
  onCopyAddress,
  receiveRequestAmount,
  onReceiveRequestAmountChange,
}: {
  panel: Panel;
  setPanel: (panel: Panel) => void;
  publicKey: string;
  phpRate: number;
  busy: boolean;
  loading: boolean;
  depositAmount: string;
  onDepositAmountChange: (value: string) => void;
  onDeposit: () => void;
  receiveMode: 'address' | 'qr';
  onReceiveModeChange: (mode: 'address' | 'qr') => void;
  copied: boolean;
  onCopyAddress: () => void;
  receiveRequestAmount: string;
  onReceiveRequestAmountChange: (value: string) => void;
}) {
  const depositValue = (Number(depositAmount) || 0) * phpRate;
  const requestValue = Number(receiveRequestAmount) || 0;

  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-5 animate-fadeIn">
      {/* Primary nav: Deposit vs Receive */}
      <div className="grid grid-cols-2 p-0.5 bg-slate-50 border border-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setPanel('deposit')}
          className={`py-2 text-[10px] uppercase tracking-wider rounded-lg transition-all ${panel === 'deposit' ? 'bg-[#E0FBFB] text-slate-800 font-normal' : 'text-slate-400 font-light hover:text-slate-500'}`}
        >
          Deposit
        </button>
        <button
          type="button"
          onClick={() => setPanel('receive')}
          className={`py-2 text-[10px] uppercase tracking-wider rounded-lg transition-all ${panel === 'receive' ? 'bg-[#E0FBFB] text-slate-800 font-normal' : 'text-slate-400 font-light hover:text-slate-500'}`}
        >
          Receive
        </button>
      </div>

      {/* Deposit */}
      {panel === 'deposit' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1.5">
            <label htmlFor="deposit-amount" className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">
              Amount
            </label>
            <div className="relative flex items-center">
              <input
                id="deposit-amount"
                type="number"
                value={depositAmount}
                onChange={(e) => onDepositAmountChange(e.target.value)}
                placeholder="0.00"
                disabled={busy}
                className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-16 py-3 text-sm text-slate-800 outline-none focus:border-[#A0F0F0] focus:bg-white disabled:opacity-50 transition-colors"
              />
              <span className="absolute right-4 text-[10px] text-slate-400 font-light">USDC</span>
            </div>
            <p className="text-right text-[10px] text-slate-400 font-light px-1">
              ≈ ₱{depositValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <button
            onClick={onDeposit}
            disabled={busy || loading || !depositAmount || Number(depositAmount) <= 0}
            className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest hover:opacity-95 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy && <Spinner className="animate-spin h-3 w-3 text-white" />}
            <span>{busy ? 'Processing…' : 'Deposit USDC'}</span>
          </button>
        </div>
      )}

      {/* Receive */}
      {panel === 'receive' && !publicKey && (
        <p className="p-4 bg-slate-50 text-[10px] text-slate-400 font-light text-center rounded-xl">
          Verify parameters to initialize transfer.
        </p>
      )}

      {panel === 'receive' && publicKey && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-end">
            <div className="flex shrink-0 p-0.5 bg-slate-50 border border-slate-100 rounded-lg">
              <button
                type="button"
                aria-label="Show address"
                aria-pressed={receiveMode === 'address'}
                onClick={() => onReceiveModeChange('address')}
                className={`p-1.5 rounded-md transition-all ${receiveMode === 'address' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 hover:text-slate-500'}`}
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Show QR code"
                aria-pressed={receiveMode === 'qr'}
                onClick={() => onReceiveModeChange('qr')}
                className={`p-1.5 rounded-md transition-all ${receiveMode === 'qr' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 hover:text-slate-500'}`}
              >
                <QrCodeIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {receiveMode === 'address' ? (
            <div className="space-y-2 animate-fadeIn">
              <p className="break-all rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed font-mono">{publicKey}</p>
              <button
                onClick={onCopyAddress}
                className="w-full py-3 rounded-xl bg-[#E0FBFB] text-slate-800 text-[10px] uppercase tracking-wider font-light flex items-center justify-center gap-1.5 transition-colors hover:bg-[#cff5f5]"
              >
                {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copied ? 'Copied Securely' : 'Copy Address'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2 space-y-3 animate-fadeIn">
              <QRCodeDisplay value={buildPaymentUri(publicKey, receiveRequestAmount)} size={168} />

              <div className="w-full space-y-1">
                <label htmlFor="receive-request-amount" className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">
                  Request Amount (optional)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="receive-request-amount"
                    type="number"
                    value={receiveRequestAmount}
                    onChange={(e) => onReceiveRequestAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-14 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
                  />
                  <span className="absolute right-4 text-[10px] text-slate-400 font-light">USDC</span>
                </div>
              </div>

              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-light text-center">
                {requestValue > 0
                  ? `Requesting ${requestValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC`
                  : 'Scan to send to this wallet'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}