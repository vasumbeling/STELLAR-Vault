'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from '@/lib/notifications';

function BellIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell({
  publicKey,
  onNavigateToVault,
}: {
  publicKey: string | null;
  onNavigateToVault?: (vaultId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) { setNotifications([]); return; }
    setLoading(true);
    try {
      setNotifications(await fetchNotifications());
    } catch {
      // silent — non-critical
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!publicKey) return;
    const interval = setInterval(() => { void refresh(); }, 30000);
    return () => clearInterval(interval);
  }, [publicKey, refresh]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleOpen = () => {
    setOpen((prev) => !prev);
  };

  const handleMarkRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      void refresh();
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      void refresh();
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) {
      await handleMarkRead(n.id);
    }
    if (n.vaultId && onNavigateToVault) {
      onNavigateToVault(n.vaultId);
      setOpen(false);
    }
  };

  if (!publicKey) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF5E00] text-white text-[9px] font-semibold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-2xl bg-white border border-slate-200/60 shadow-lg shadow-slate-900/10 z-50 animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-700">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] uppercase tracking-wider text-[#FF5E00] font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <p className="px-4 py-6 text-[11px] text-slate-400 text-center">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-[11px] text-slate-400 text-center">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-2 items-start transition-colors ${
                    n.read ? 'bg-white' : 'bg-orange-50/60 hover:bg-orange-50'
                  } ${n.vaultId ? 'cursor-pointer' : ''}`}
                >
                  {!n.read && <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#FF5E00] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] leading-snug ${n.read ? 'text-slate-500' : 'text-slate-700 font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}