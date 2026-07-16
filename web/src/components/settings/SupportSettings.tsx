'use client';

import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, SupportIcon } from '@/app/icons';

interface Faq {
  q: string;
  a: string;
}

const FAQS: Faq[] = [
  {
    q: 'What is STELLA Vault?',
    a: 'STELLA Vault is a savings app built on the Stellar network. Your USDC is held in your own non-custodial wallet — STELLA never holds your funds.',
  },
  {
    q: 'How do I fund my wallet?',
    a: 'On the home screen, tap the faucet icon to pull test network assets, or deposit USDC directly to your wallet address from the Receive panel.',
  },
  {
    q: 'What is a trustline, and why do I need one?',
    a: 'A trustline tells the Stellar network your account is willing to hold a specific asset. You need a USDC trustline before your wallet can receive or hold USDC.',
  },
  {
    q: 'Why do I need to enter my PIN again?',
    a: 'Your wallet signer key is protected by your PIN. If your session times out, you\'ll be asked to unlock it again before signing a new transaction.',
  },
  {
    q: 'Is my money safe?',
    a: 'Your funds live in your own Stellar wallet, secured by a signer key encrypted on your device with your PIN. STELLA cannot move funds on your behalf.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account → Delete Account. You\'ll need to withdraw vault balances and settle any pending transfers first.',
  },
];

interface SupportSettingsProps {
  onBack?: () => void;
}

export default function SupportSettings({ onBack }: SupportSettingsProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
        <h3 className="text-base font-semibold text-slate-800 tracking-tight">Support</h3>
      </div>

      <div className="flex items-center gap-2 bg-orange-50/70 rounded-xl px-4 py-3">
        <SupportIcon className="text-[#FF9F1C] w-4 h-4 shrink-0" />
        <p className="text-xs text-orange-900/70">Most questions are answered below. More help is on the way.</p>
      </div>

      {/* FAQs */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">FAQs</p>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={faq.q}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-medium text-slate-700 pr-2">{faq.q}</span>
                  <ChevronRightIcon
                    className={`text-slate-300 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                {isOpen && (
                  <p className="px-4 pb-3.5 text-xs text-slate-500 leading-relaxed animate-fade-in">{faq.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Contact + website */}
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Still Need Help?</p>
        <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 shadow-xs overflow-hidden">
          <a
            href="mailto:support@stellavault.app"
            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-slate-50 active:scale-[0.99] transition-all cursor-pointer"
          >
            <span className="text-sm font-medium text-slate-700">Email Support</span>
            <span className="text-xs text-slate-400">support@stellavault.app</span>
          </a>
          <div className="w-full flex items-center justify-between gap-3 px-4 py-3.5 opacity-50 cursor-not-allowed">
            <span className="text-sm font-medium text-slate-700">Visit Support Website</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 rounded-full px-2 py-1">
              Coming Soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
