import { authFetch } from './wallet';

export interface AppNotification {
  id: string;
  pubkey: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await authFetch('/api/notifications');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to load notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await authFetch(`/api/notifications/${id}`, { method: 'PATCH' });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to update notification');
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await authFetch('/api/notifications/read-all', { method: 'PATCH' });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data?.error ?? 'Failed to mark notifications read');
  }
}