import { authFetch } from './wallet';

export type AppNotificationVariant = 'success' | 'info' | 'warning' | 'error' | 'action_required';

export interface AppNotification {
  id: string;
  pubkey: string;
  message: string;
  read: boolean;
  vaultId: string | null;
  variant: AppNotificationVariant;
  meta?: Record<string, unknown> | null;
  createdAt: string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await authFetch('/api/notifications');
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to load notifications');
  return data;
}

export async function createAppNotification(params: {
  message: string;
  vaultId?: string | null;
  variant?: AppNotificationVariant;
  meta?: Record<string, unknown> | null;
}): Promise<AppNotification> {
  const res = await authFetch('/api/notifications', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Failed to create notification');
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