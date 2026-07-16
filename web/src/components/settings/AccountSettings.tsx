'use client';

import React, { useState } from 'react';
import { authFetch } from '@/lib/wallet';
import { ChevronLeftIcon, LogoutIcon, TrashIcon, Spinner } from '@/app/icons';

interface AccountSettingsProps {
  onBack?: () => void;
  onLogout: () => void | Promise<void>;
  phoneNumber?: string;
}

export default function AccountSettings({ onBack, onLogout, phoneNumber }: AccountSettingsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await authFetch('/api/users/me', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to delete account');
      }
      // Account is soft-deleted server-side — clear local session same as a normal logout.
      await onLogout();
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-1">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to settings"
            className="p-1 -ml-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <ChevronLeftIcon />
          </button>
        )}
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Account</h3>
      </div>

      {phoneNumber && (
        <p className="px-1 text-xs text-slate-400">Signed in with {phoneNumber}</p>
      )}

      {/* Session */}
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 bg-white border border-slate-200/60 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
      >
        <LogoutIcon className="text-slate-400" />
        Log Out
      </button>

      {/* Danger zone */}
      <div className="pt-2 space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Danger Zone</p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center gap-3 bg-white border border-rose-100 rounded-2xl px-4 py-3.5 text-sm font-medium text-rose-500 hover:bg-rose-50 active:scale-[0.99] transition-all cursor-pointer"
        >
          <TrashIcon />
          Delete Account
        </button>
      </div>

      {/* Delete account confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setShowDeleteConfirm(false);
          }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-800">Delete your account?</h3>
            <p className="text-xs font-normal text-slate-500 leading-relaxed">
              This cannot be undone. Withdraw or distribute funds from any vault you own before deleting — the server will block deletion if a vault you own still has a balance, or if you have a transfer in progress.
            </p>

            {deleteError && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
                <p className="text-xs font-medium text-rose-600 leading-normal">{deleteError}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Spinner className="animate-spin h-3 w-3 text-white" />}
                {deleting ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-[11px] uppercase tracking-wide text-slate-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}