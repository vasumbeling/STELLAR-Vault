'use client';

import { SparkleStar } from '@/app/icons';
import QRScanner from '@/components/shared/QRScanner';
import type { PendingTransferApproval } from '@/lib/transfer';

export default function SendPanel({
  publicKey,
  sendMode,
  onSendModeChange,
  pendingApproval,
  recipient,
  onRecipientChange,
  transferAmount,
  onTransferAmountChange,
  busy,
  onTransferRequest,
  onApproveAsSender,
  onApproveAsReceiver,
  onSubmitApprovedTransfer,
  onVoidPendingApproval,
  needsPin,
  scannedOk,
  scanError,
  onQrScanResult,
}: {
  publicKey: string | null;
  sendMode: 'amount' | 'qr';
  onSendModeChange: (mode: 'amount' | 'qr') => void;
  pendingApproval: PendingTransferApproval | null;
  recipient: string;
  onRecipientChange: (value: string) => void;
  transferAmount: string;
  onTransferAmountChange: (value: string) => void;
  busy: boolean;
  onTransferRequest: () => void;
  onApproveAsSender: () => void;
  onApproveAsReceiver: () => void;
  onSubmitApprovedTransfer: () => void;
  onVoidPendingApproval: () => void;
  needsPin: boolean;
  scannedOk: boolean;
  scanError: string;
  onQrScanResult: (raw: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-4 animate-fadeIn">
      {!publicKey ? (
        <p className="p-4 bg-slate-50 text-[10px] text-slate-400 font-light text-center">Verify parameters to initialize transfer.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 p-0.5 bg-slate-50 border border-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => onSendModeChange('amount')}
              className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${sendMode === 'amount' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
            >
              Enter
            </button>
            <button
              type="button"
              onClick={() => onSendModeChange('qr')}
              className={`py-1.5 text-[10px] uppercase tracking-wider rounded-lg transition-all ${sendMode === 'qr' ? 'bg-[#E0FBFB] text-slate-800' : 'text-slate-400 font-light'}`}
            >
              Scan
            </button>
          </div>

          {sendMode === 'amount' ? (
            <>
              {!pendingApproval && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Address</label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => onRecipientChange(e.target.value)}
                      placeholder="Stellar Public Address (G...)"
                      disabled={busy}
                      className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-[11px] font-mono text-slate-600 outline-none focus:border-[#A0F0F0] transition-colors"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Amount</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => onTransferAmountChange(e.target.value)}
                        placeholder="0.00"
                        disabled={busy}
                        className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-14 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
                      />
                      <span className="absolute right-4 text-[10px] text-slate-400">USDC</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onTransferRequest}
                    disabled={busy || !recipient || !transferAmount || Number(transferAmount) <= 0}
                    className="w-full py-3 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest hover:opacity-95 transition-opacity disabled:opacity-40"
                  >
                    {busy ? 'Sending Request…' : 'Request'}
                  </button>
                </div>
              )}

              {pendingApproval && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3 text-[11px] animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[10px] uppercase text-slate-400 font-light tracking-wider">Pending Tx</span>
                    <span className="font-normal text-slate-800">{pendingApproval.amount} USDC</span>
                  </div>
                  <div className="space-y-0.5 text-slate-400 font-light text-[10px]">
                    <p className="truncate"><span className="uppercase tracking-wide">From:</span> {pendingApproval.sender}</p>
                    <p className="truncate"><span className="uppercase tracking-wide">To:</span> {pendingApproval.recipient}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[9px] tracking-wide text-center uppercase font-light">
                    <div className={`p-1.5 rounded-lg border ${pendingApproval.senderAuthorized ? 'bg-[#E0FBFB] border-[#A0F0F0] text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      Sender {pendingApproval.senderAuthorized ? '✓' : '○'}
                    </div>
                    <div className={`p-1.5 rounded-lg border ${pendingApproval.receiverAuthorized ? 'bg-[#E0FBFB] border-[#A0F0F0] text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                      Receiver {pendingApproval.receiverAuthorized ? '✓' : '○'}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {pendingApproval.sender === publicKey && !pendingApproval.senderAuthorized && (
                      <button type="button" onClick={onApproveAsSender} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-wider disabled:opacity-50">
                        Sign Sender
                      </button>
                    )}
                    {pendingApproval.recipient === publicKey && !pendingApproval.receiverAuthorized && (
                      <button type="button" onClick={onApproveAsReceiver} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-wider disabled:opacity-50">
                        Sign Receiver
                      </button>
                    )}
                    {pendingApproval.sender === publicKey && pendingApproval.senderAuthorized && pendingApproval.receiverAuthorized && (
                      <button type="button" onClick={onSubmitApprovedTransfer} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white text-[10px] uppercase tracking-widest font-normal disabled:opacity-50">
                        {busy ? 'Processing…' : 'Submit Payload'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onVoidPendingApproval}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-[10px] uppercase tracking-wide disabled:opacity-50"
                    >
                      Void
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3 animate-fadeIn">
              <QRScanner
                active={sendMode === 'qr' && !pendingApproval && !needsPin}
                onScan={onQrScanResult}
              />
              {scannedOk && (
                <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-light">
                  <SparkleStar className="w-3 h-3" />
                  Address captured
                </p>
              )}
              {scanError && (
                <p className="text-[10px] text-rose-500 font-light text-center px-4">{scanError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
