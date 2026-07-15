'use client';

export default function PinUnlockPanel({
  pinInput,
  onPinInputChange,
  pinError,
  unlocking,
  onUnlock,
  onCancel,
}: {
  pinInput: string;
  onPinInputChange: (value: string) => void;
  pinError: string;
  unlocking: boolean;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 p-5 text-[#1A1A1A] space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-light">
        Enter PIN
      </p>
      <input
        type="password"
        inputMode="numeric"
        value={pinInput}
        onChange={(e) => onPinInputChange(e.target.value)}
        placeholder="••••••"
        disabled={unlocking}
        className="w-full rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-2.5 text-xs outline-none focus:border-[#A0F0F0] disabled:opacity-50"
      />
      {pinError && <p className="text-[10px] text-rose-500">{pinError}</p>}
      <div className="flex gap-2">
        <button
          onClick={onUnlock}
          disabled={unlocking || !pinInput}
          className="flex-1 rounded-xl bg-linear-to-r from-[#FF9F1C] to-[#F37A00] text-white py-2.5 text-[10px] uppercase tracking-widest font-normal disabled:opacity-40"
        >
          {unlocking ? 'Unlocking…' : 'Unlock'}
        </button>
        <button
          onClick={onCancel}
          disabled={unlocking}
          className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
