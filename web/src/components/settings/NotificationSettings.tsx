'use client';

import React, { useState } from 'react';
import { ChevronLeftIcon } from '@/app/icons';
import Toggle from './Toggle';

interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  default: boolean;
}

const SETTINGS: NotificationSetting[] = [
  { key: 'transactions', label: 'Transaction Alerts', description: 'Deposits, withdrawals, and transfers', default: true },
  { key: 'vaults', label: 'Vault Milestones', description: 'Goal progress and vault activity', default: true },
  { key: 'security', label: 'Security Alerts', description: 'New device sign-ins and PIN changes', default: true },
  { key: 'price', label: 'Price Alerts', description: 'Notable USDC / PHP rate movement', default: false },
  { key: 'updates', label: 'Product Updates', description: 'New features and announcements', default: false },
];

interface NotificationSettingsProps {
  onBack?: () => void;
}

export default function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    () => Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]))
  );

  const setPref = (key: string, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
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
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Notifications</h3>
      </div>

      <p className="px-1 text-xs text-slate-400">Choose what you get alerted about. Security alerts can't be turned off.</p>

      <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
        {SETTINGS.map((setting) => {
          const locked = setting.key === 'security';
          return (
            <div key={setting.key} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{setting.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{setting.description}</p>
              </div>
              <Toggle
                checked={locked ? true : prefs[setting.key]}
                onChange={(next) => setPref(setting.key, next)}
                disabled={locked}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
