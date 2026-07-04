'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface ProfileProps {
  publicKey: string | null;
  phpRate: number;
  purchasingPowerSaved: number;
  copied: boolean;
  onCopyAddress: () => void;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  wallet: {
    status?: string;
    network?: string;
    provider?: string;
    signerAvailable?: boolean;
    error?: string | null;
  };
}

function ShieldIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>
  );
}

function ChevronDownIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

function LogoutIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );
}

export default function Profile({ 
  publicKey, 
  phpRate, 
  purchasingPowerSaved,
  copied, 
  onCopyAddress, 
  loading, 
  onRefresh, 
  onLogout,
  wallet 
}: ProfileProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { status, network, provider, signerAvailable, error } = wallet || {};

  return (
    // Added horizontal margin/padding padding spacing across the root container
    <div className="px-6 py-2 space-y-6 animate-fade-in">
      
      {/* Copied Layout Header from History component with boosted edge matching */}
      <div className="flex justify-between items-center px-1">
        <h3 className="text-xl font-black text-[#FF5E00] tracking-tight">Profile</h3>
        <button 
          onClick={onRefresh} 
          disabled={loading} 
          className="px-5 py-2 text-xs font-black bg-[#9AFAFA] text-[#0F4F53] rounded-full shadow-md shadow-cyan-300/10 hover:bg-[#7becec] active:scale-95 disabled:opacity-50 uppercase tracking-widest transition-all duration-200 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-1.5 justify-center">
              <svg className="animate-spin h-3 w-3 text-[#0F4F53]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Polling Network…
            </span>
          ) : (
            'Sync Data'
          )}
        </button>
      </div>

      {/* Cryptographic Session State Dropdown inside Profile view */}
      <section className="rounded-3xl border border-slate-200/60 bg-white shadow-md shadow-slate-900/2 overflow-hidden transition-all duration-300">
        <button 
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between gap-2 p-6 hover:bg-slate-50/40 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-slate-800 tracking-tight">
            <ShieldIcon className="h-4 w-4 text-[#FF5E00]" />
            Wallet Status
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-orange-50 border border-orange-100/60 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#FF5E00]">
              {status || 'Disconnected'}
            </span>
            <ChevronDownIcon 
              className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-[#FF5E00]' : ''}`} 
            />
          </div>
        </button>
        
        <div 
          className={`transition-all duration-300 ease-in-out border-slate-100 ${
            isDropdownOpen 
              ? 'max-h-105 border-t p-6 opacity-100' 
              : 'max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="grid gap-4 text-xs grid-cols-2">
            <div className="space-y-1 col-span-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Public Key Link</span>
              <p className="font-mono font-bold text-slate-600 break-all bg-slate-50 border border-slate-100/50 p-3 rounded-xl mt-1 text-[11px] leading-relaxed">
                {publicKey ? publicKey : 'Not connected'}
              </p>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Horizon Node</span>
              <p className="font-bold text-slate-800 capitalize mt-0.5 text-sm">{network || 'none'}</p>
            </div>
            
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Bridge Extension</span>
              <p className="font-bold text-slate-800 capitalize mt-0.5 text-sm">{provider || 'none'}</p>
            </div>
            
            <div className="space-y-0.5 col-span-2 pt-3 border-t border-slate-100/70">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cryptographic Signer</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${signerAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <p className={`font-black text-xs ${signerAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {signerAvailable ? 'Live & Available' : 'Locked'}
                </p>
              </div>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
              <p className="text-[11px] font-bold text-rose-600 leading-normal">{error}</p>
            </div>
          )}
        </div>
      </section>

      {/* Main Core Profile Configurations + Integrated Mascot Wrapper */}
      <div className="p-6 bg-white border border-slate-200/60 rounded-3xl shadow-md shadow-slate-900/1 space-y-5">
        
        {/* Brand Custodian Row */}
        <div className="flex items-center gap-4 bg-slate-50/60 border border-slate-100 p-4 rounded-2xl">
          <div className="w-12 h-12 relative shrink-0">
            <Image 
              src="/stellamascot.png"
              alt="Stella Mascot"
              fill
              priority
              sizes="48px"
              className="object-contain"
            />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Vault Custodian</h4>
            <p className="text-[10px] font-bold text-slate-400 leading-normal">
              Stella is protecting and validating your secure Soroban nodes.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Account Operations</h3>
          
          <button
            onClick={onCopyAddress}
            className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 border border-slate-200/50 p-4 rounded-2xl transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-slate-700">Wallet Address</span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-between bg-rose-50 hover:bg-rose-100/80 border border-rose-100/60 p-4 rounded-2xl transition-colors cursor-pointer"
          >
            <span className="text-xs font-bold text-rose-600 flex items-center gap-2">
              <LogoutIcon className="h-3.5 w-3.5" />
              Log Out
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-600">
              Disconnect
            </span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 space-y-1.5 px-1">
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span className="font-semibold">Conversion Rate:</span>
            <span className="font-bold text-slate-700">1 USDC ≈ ₱{phpRate.toFixed(2)} PHP</span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span className="font-semibold">Purchasing Power Defended:</span>
            <span className="font-bold text-emerald-600">+₱{purchasingPowerSaved.toLocaleString(undefined, { maximumFractionDigits: 2 })} Saved</span>
          </div>
        </div>
      </div>

    </div>
  );
}