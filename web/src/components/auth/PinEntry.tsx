'use client';

import { useState, useEffect } from 'react';

interface PinEntryProps {
  onSuccess: () => void;
  onForgotPin?: () => void;
}

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;

export function PinEntry({ onSuccess, onForgotPin }: PinEntryProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [shake, setShake] = useState(false);

  // Countdown timer when locked
  useEffect(() => {
    if (!locked || lockTimer <= 0) return;
    const interval = setInterval(() => {
      setLockTimer((t) => {
        if (t <= 1) {
          setLocked(false);
          setAttempts(0);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [locked, lockTimer]);

  // Auto-submit when PIN is full
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !loading && !locked) {
      handleUnlock();
    }
  }, [pin]);

  function handleDigit(digit: string) {
    if (locked || loading) return;
    if (pin.length < PIN_LENGTH) {
      setPin((p) => p + digit);
      setError('');
    }
  }

  function handleBackspace() {
    if (locked || loading) return;
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  async function handleUnlock() {
    if (pin.length !== PIN_LENGTH) return;
    setLoading(true);
    setError('');

    try {
      const { unlockPinAccount } = await import('@/lib/wallet');
      await unlockPinAccount(pin);
      onSuccess();
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');

      setShake(true);
      setTimeout(() => setShake(false), 500);

      const message = e instanceof Error ? e.message : 'Incorrect PIN';
      const isWrongPin = message === 'Incorrect PIN';

      if (!isWrongPin) {
        setAttempts(attempts);
        setError(message);
      }
      else if (newAttempts >= MAX_ATTEMPTS) {
        setLocked(true);
        setLockTimer(30);
        setError(`Too many attempts. Try again in 30 seconds.`);
      } else {
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(
          `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full flex flex-col items-center bg-[#FAF8F5] select-none text-slate-600 antialiased">
      
      {/* Minimal Top Brand Row */}
      <div className="w-full flex items-center justify-between mb-16 px-2">
      </div>

      {/* Typography Configuration - Scaled back down to clean, lightweight weights */}
      <div className="text-center space-y-1 mb-12">
        <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Welcome back</h2>
        <p className="text-xs font-normal text-slate-400">Enter your PIN to unlock your vault</p>
      </div>

      {/* 6-Digit Minimal Status Indicators */}
      <div className={`flex gap-4 justify-center mb-12 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
              i < pin.length
                ? error
                  ? 'bg-red-400 border-red-400'
                  : 'bg-[#FF5E00] border-[#FF5E00]'
                : locked
                ? 'border-slate-200 bg-slate-100'
                : 'border-amber-200 bg-transparent'
            }`}
          />
        ))}
      </div>

      {/* Status Alert Drawer */}
      <div className="w-full max-w-xs h-10 flex items-center justify-center mb-8 text-center px-4">
        {locked ? (
          <div className="w-full bg-red-50/50 border border-red-100/50 rounded-xl py-2">
            <p className="text-red-600 text-xs font-medium">Vault Temporarily Locked</p>
            <p className="text-red-400 text-[10px] font-mono mt-0.5">Try again in {lockTimer}s</p>
          </div>
        ) : error ? (
          <p className="text-red-500 text-xs font-medium bg-red-50/40 border border-red-100/40 rounded-xl py-2 px-4 w-full">{error}</p>
        ) : loading ? (
          <span className="text-[10px] tracking-wider font-medium bg-cyan-50/60 text-cyan-700 px-3 py-1 rounded-md uppercase border border-cyan-100/40 font-mono">
            Unlocking...
          </span>
        ) : null}
      </div>

      {/* Clean Grid Pad Framework - Weight shifted away from heavy font-bold */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-x-5 gap-y-4 px-4 mb-12">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              if (key === '⌫') handleBackspace();
              else if (key !== '') handleDigit(key);
            }}
            disabled={key === '' || locked || loading}
            className={`h-12 rounded-xl text-base font-medium flex items-center justify-center transition-all outline-none select-none ${
              key === ''
                ? 'opacity-0 pointer-events-none'
                : locked || loading
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

      {/* Primary Action Footer Anchor Link */}
      {onForgotPin && (
        <button
          type="button"
          onClick={onForgotPin}
          className="text-xs font-medium text-[#FF5E00]/80 hover:text-[#FF9F1C] transition-colors tracking-wide font-mono py-2"
        >
          Recover via Phrase
        </button>
      )}
    </div>
  );
}