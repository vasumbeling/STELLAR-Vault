'use client';

import { useState, useEffect } from 'react';
import { RecoveryPhrase } from './RecoveryPhrase';

interface CreateAccountProps {
  onComplete: (publicKey: string) => void;
  onBack?: () => void;
}

const PIN_LENGTH = 6;

export function CreateAccount({ onComplete, onBack }: CreateAccountProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activeField, setActiveField] = useState<'pin' | 'confirm'>('pin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // New: once the account is created we hold onto its keys here until the
  // user has confirmed they saved the recovery phrase, then we call onComplete.
  const [stage, setStage] = useState<'pin' | 'recovery'>('pin');
  const [pendingPublicKey, setPendingPublicKey] = useState('');
  const [pendingMnemonic, setPendingMnemonic] = useState('');

  function handleDigit(digit: string) {
    if (activeField === 'pin') {
      if (pin.length < PIN_LENGTH) setPin((p) => p + digit);
    } else {
      if (confirmPin.length < PIN_LENGTH) setConfirmPin((p) => p + digit);
    }
    setError('');
  }

  useEffect(() => {
    if (pin.length === PIN_LENGTH && activeField === 'pin') {
      setActiveField('confirm');
    }
  }, [pin, activeField]);

  function handleBackspace() {
    if (activeField === 'pin') {
      setPin((p) => p.slice(0, -1));
    } else {
      if (confirmPin.length === 0) {
        setActiveField('pin');
        setPin((p) => p.slice(0, -1));
      } else {
        setConfirmPin((p) => p.slice(0, -1));
      }
    }
    setError('');
  }

  async function handleCreateAccount() {
    if (pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) return;
    if (pin !== confirmPin) { /* existing mismatch handling */ }

    setLoading(true);
    setError('');
    try {
      const { walletService } = await import('@/lib/wallet');
      // walletService.createPinAccount must now return the mnemonic generated
      // in stellar.ts's generateKeypair() alongside the public key, e.g.
      // { publicKey, mnemonic }. See note below this file.
      const { publicKey, mnemonic } = await walletService.createPinAccount(pin);
      setPendingPublicKey(publicKey);
      setPendingMnemonic(mnemonic);
      setStage('recovery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to securely initialize hardware vaults.');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'recovery') {
    return (
      <RecoveryPhrase
        mnemonic={pendingMnemonic}
        onConfirmed={() => onComplete(pendingPublicKey)}
        onBack={() => {
          // User backed out before confirming the phrase — return to PIN
          // entry rather than leaving them on a half-created account.
          setStage('pin');
          setPin('');
          setConfirmPin('');
          setActiveField('pin');
          setPendingPublicKey('');
          setPendingMnemonic('');
        }}
      />
    );
  }

  const currentDisplayLength = activeField === 'pin' ? pin.length : confirmPin.length;

  return (
    <div className="w-full flex flex-col items-center bg-[#FAF8F5] select-none text-slate-600 antialiased">
      {/* Top Header Branding Row */}
      <div className="w-full flex items-center justify-between mb-16 px-2">
      </div>

      {/* Typography Configuration */}
      <div className="text-center space-y-1 mb-12">
        <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
          {activeField === 'pin' ? 'Create security PIN' : 'Confirm security PIN'}
        </h2>
        <p className="text-xs font-normal text-slate-400">
          {activeField === 'pin' 
            ? 'Choose a secure 6-digit PIN' 
            : 'Re-enter your PIN'
          }
        </p>
      </div>

      {/* 6-Digit Minimal Dot Indicators */}
      <div className="flex gap-4 justify-center mb-12">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
              i < currentDisplayLength
                ? error
                  ? 'bg-red-400 border-red-400'
                  : 'bg-[#FF5E00] border-[#FF5E00]'
                : 'border-amber-200 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Alert Banner / Actions Drawer */}
      <div className="w-full max-w-xs h-10 flex items-center justify-center mb-8 text-center px-4">
        {error ? (
          <p className="text-red-500 text-xs font-medium bg-red-50/40 border border-red-100/40 rounded-xl py-2 px-4 w-full">
            {error}
          </p>
        ) : loading ? (
          <span className="text-[10px] tracking-wider font-medium bg-cyan-50/60 text-cyan-700 px-3 py-1 rounded-md uppercase border border-cyan-100/40 font-mono animate-pulse">
            Saving...
          </span>
        ) : activeField === 'confirm' ? (
          <button
            type="button"
            onClick={() => {
              setPin('');
              setConfirmPin('');
              setActiveField('pin');
              setError('');
            }}
            className="text-[10px] uppercase font-mono tracking-wider text-slate-400 hover:text-[#FF5E00] transition-colors"
          >
            Restart
          </button>
        ) : null}
      </div>

      {/* Keypad Layout */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-x-5 gap-y-4 px-4 mb-12">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (key === '⌫') handleBackspace();
              else if (key !== '') handleDigit(key);
            }}
            disabled={key === '' || loading}
            className={`h-12 rounded-xl text-base font-medium flex items-center justify-center transition-all outline-none select-none ${
              key === ''
                ? 'opacity-0 pointer-events-none'
                : loading
                ? 'text-slate-300 bg-transparent cursor-not-allowed'
                : key === '⌫'
                ? 'text-slate-400 active:scale-95'
                : 'bg-white border border-amber-100/30 text-slate-600 hover:border-amber-200/50 active:scale-95'
            }`}
          >
            {key === '⌫' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
              </svg>
            ) : key}
          </button>
        ))}
      </div>

      {/* Primary Context Submits */}
      {pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && !loading ? (
        <button
          type="button"
          onClick={handleCreateAccount}
          className="w-full max-w-xs bg-[#FF9F1C] hover:bg-[#FF8C00] text-white rounded-xl py-3.5 text-sm font-medium tracking-wide transition-all shadow-xs active:scale-98"
        >
          Confirm
        </button>
      ) : (
        onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-medium text-slate-400 hover:text-slate-500 transition-colors tracking-wide py-2"
          >
            Cancel Setup
          </button>
        )
      )}
    </div>
  );
}