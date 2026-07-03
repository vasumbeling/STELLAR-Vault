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
  }, [locked]);

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
      const { walletService } = await import('@/lib/wallet');
      const { unlockPinAccount } = await import('@/lib/wallet');
      await unlockPinAccount(pin);
      onSuccess();
    } catch (e) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');

      // Shake animation
      setShake(true);
      setTimeout(() => setShake(false), 500);

      if (newAttempts >= MAX_ATTEMPTS) {
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
    <div className="space-y-8">
      <div className="text-center space-y-1">
        <div className="text-3xl">🏦</div>
        <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>
        <p className="text-sm text-gray-500">Enter your PIN to unlock your vault</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-3 justify-center">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
              shake ? 'animate-bounce' : ''
            } ${
              i < pin.length
                ? error
                  ? 'bg-red-500 border-red-500'
                  : 'bg-blue-600 border-blue-600'
                : locked
                ? 'border-gray-200 bg-gray-50'
                : 'border-gray-300'
            }`}
          >
            {i < pin.length && <div className="w-3 h-3 rounded-full bg-white" />}
          </div>
        ))}
      </div>

      {/* Error / lock state */}
      {locked ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          <p className="text-red-600 text-sm font-medium">Account temporarily locked</p>
          <p className="text-red-500 text-xs mt-1">
            Try again in {lockTimer}s
          </p>
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm text-center">{error}</p>
      ) : loading ? (
        <p className="text-blue-500 text-sm text-center">Unlocking vault…</p>
      ) : null}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (key === '⌫') handleBackspace();
              else if (key !== '') handleDigit(key);
            }}
            disabled={key === '' || locked || loading}
            className={`h-14 rounded-2xl text-xl font-medium transition-all active:scale-95 select-none ${
              key === ''
                ? 'opacity-0 pointer-events-none'
                : locked || loading
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : key === '⌫'
                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* Forgot PIN */}
      {onForgotPin && (
        <button
          onClick={onForgotPin}
          className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          Forgot PIN? Recover with phrase
        </button>
      )}
    </div>
  );
}