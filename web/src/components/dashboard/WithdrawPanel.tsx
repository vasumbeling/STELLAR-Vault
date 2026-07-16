'use client';

export default function WithdrawPanel({
  withdrawAmount,
  onWithdrawAmountChange,
  busy,
  usdcBalance,
  phpRate,
}: {
  withdrawAmount: string;
  onWithdrawAmountChange: (value: string) => void;
  busy: boolean;
  usdcBalance: number;
  phpRate: number;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-4 animate-fadeIn">
      <div className="space-y-1">
        <div className="flex justify-between items-baseline">
          <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-light">Withdraw</label>
          <span className="text-[9px] text-slate-400 font-light">Balance: {usdcBalance.toFixed(2)}</span>
        </div>
        <div className="relative flex items-center">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => onWithdrawAmountChange(e.target.value)}
            placeholder="0.00"
            disabled={busy}
            className="w-full rounded-xl bg-slate-50 border border-slate-100 pl-4 pr-20 py-2.5 text-xs text-slate-800 outline-none focus:border-[#A0F0F0] transition-colors"
          />
          <div className="absolute right-2 flex items-center gap-1">
            <span className="text-[10px] text-slate-400 mr-1">USDC</span>
            <button
              onClick={() => onWithdrawAmountChange(Math.floor(usdcBalance).toString())}
              className="px-1.5 py-0.5 text-[9px] text-slate-600 bg-[#E0FBFB] rounded uppercase font-light"
            >
              Max
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 px-3 py-2 flex justify-between items-center text-[10px]">
        <span className="uppercase text-slate-400 font-light tracking-wider">Fiat Value</span>
        <span className="text-slate-500">
          ₱{((Number(withdrawAmount) || 0) * phpRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      <button disabled className="w-full py-3 rounded-xl bg-slate-50 text-slate-300 text-[10px] uppercase tracking-widest cursor-not-allowed font-light">
        Feature Pending
      </button>
    </div>
  );
}
