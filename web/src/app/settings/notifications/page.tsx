'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import NotificationSettings from '@/components/settings/NotificationSettings';

export default function NotificationSettingsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] flex items-center justify-center p-4">
      <div className="w-full max-w-md min-h-210 bg-[#fffdfb] rounded-[2.5rem] overflow-hidden shadow-xl relative flex flex-col font-sans tracking-tight border border-slate-200/40 text-[#1A1A1A]">
        <div className="flex-1 overflow-y-auto px-6 pt-7 pb-8">
          <NotificationSettings onBack={() => router.back()} />
        </div>
      </div>
    </main>
  );
}