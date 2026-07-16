'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AccountSettings from '@/components/settings/AccountSettings';
import { useWallet } from '@/hooks/useWallet';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { disconnect } = useWallet();

  const handleLogout = async () => {
    await disconnect(); // clears 'stella-vault.wallet', same as Home's handleLogout
    router.replace('/login');
  };

  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md min-h-210 bg-[#fffdfb] rounded-[2.5rem] overflow-hidden shadow-xl relative flex flex-col font-sans tracking-tight border border-slate-200/40 text-[#1A1A1A]">
        <div className="flex-1 overflow-y-auto px-6 pt-7 pb-8">
          <AccountSettings
            onBack={() => router.back()}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </main>
  );
}