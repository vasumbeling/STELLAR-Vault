'use client';

import { useEffect } from 'react';

function XIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function ActionModal({
  open,
  onClose,
  icon,
  iconClassName = 'bg-slate-100 text-slate-400',
  title,
  statusLabel,
  statusClassName = 'bg-slate-100 text-slate-500',
  children,
}: {
  open: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  statusLabel?: string;
  statusClassName?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl bg-white shadow-2xl shadow-slate-900/10 overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-6 pb-5 text-center border-b border-slate-100">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <XIcon className="w-4 h-4" />
          </button>

          <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${iconClassName}`}>
            {icon}
          </div>

          <h3 className="mt-3 text-sm font-bold text-slate-800 tracking-tight">{title}</h3>

          {statusLabel && (
            <span
              className={`inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold rounded-full px-2.5 py-1 transition-colors ${statusClassName}`}
            >
              {statusLabel}
            </span>
          )}
        </div>

        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
