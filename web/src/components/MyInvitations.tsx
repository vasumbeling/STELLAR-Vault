'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchMyInvitations, respondToInvitation, type Invitation } from '@/lib/invitations';

export default function MyInvitations({
  onResponded,
  focusVaultId,
  onFocusHandled,
}: {
  onResponded?: () => void;
  focusVaultId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const refresh = useCallback(async () => {
    try {
      setInvites(await fetchMyInvitations());
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Deep-link support: highlight + scroll to the invitation matching the
  // vault a notification pointed at, since it isn't a real vault card yet.
  useEffect(() => {
    if (!focusVaultId || invites.length === 0) return;

    const match = invites.find((inv) => inv.vaultId === focusVaultId);
    if (!match) return;

    setHighlightId(match.id);
    const scrollTimeout = setTimeout(() => {
      cardRefs.current.get(match.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled?.();
    }, 50);
    const clearTimeout2 = setTimeout(() => setHighlightId(null), 2550);

    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(clearTimeout2);
    };
  }, [focusVaultId, invites, onFocusHandled]);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    setBusyId(id);
    setError('');
    try {
      await respondToInvitation(id, status);
      await refresh();
      onResponded?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to respond');
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/60 shadow-md shadow-slate-900/5 space-y-2">
      <h4 className="text-xs font-semibold text-slate-700">Vault Invitations</h4>
      {error && <p className="text-[10px] text-rose-500">{error}</p>}
      {invites.map((inv) => (
        <div
          key={inv.id}
          ref={(el) => {
            if (el) cardRefs.current.set(inv.id, el);
            else cardRefs.current.delete(inv.id);
          }}
          className={`flex items-center justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2.5 transition-all duration-700 ${
            highlightId === inv.id ? 'ring-2 ring-[#FF9F1C]/50 bg-orange-50/60' : ''
          }`}
        >
          <span className="text-[11px] text-slate-600">
            Join <span className="font-medium">{inv.vault?.name ?? 'a vault'}</span>?
          </span>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => respond(inv.id, 'accepted')}
              disabled={busyId === inv.id}
              className="px-2.5 py-1 rounded-lg bg-[#FF9F1C] text-white text-[9px] font-semibold uppercase disabled:opacity-50"
            >
              Accept
            </button>
            <button
              onClick={() => respond(inv.id, 'declined')}
              disabled={busyId === inv.id}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-semibold uppercase disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}