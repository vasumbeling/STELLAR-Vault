'use client';

export default function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10.5 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 cursor-pointer ${
        checked ? 'bg-[#FF9F1C]' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
