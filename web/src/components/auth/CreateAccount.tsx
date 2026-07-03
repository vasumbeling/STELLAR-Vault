'use client';

import { useState, useEffect } from 'react';
import { RecoveryPhrase } from '@/components/auth/RecoveryPhrase';

interface CreateAccountProps {
  onComplete: (publicKey: string) => void;
  onBack?: () => void;
}

type Step = 'pin' | 'recovery' | 'done';

const PIN_LENGTH = 6;

export function CreateAccount({ onComplete, onBack }: CreateAccountProps) {
  const [step, setStep] = useState<Step>('pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activeField, setActiveField] = useState<'pin' | 'confirm'>('pin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicKey, setPublicKey] = useState('');

  function handleDigit(digit: string) {
    if (activeField === 'pin') {
      if (pin.length < PIN_LENGTH) setPin((p) => p + digit);
    } else {
      if (confirmPin.length < PIN_LENGTH) setConfirmPin((p) => p + digit);
    }
    setError('');
  }

  // Auto-advance from PIN to Confirm once 6 digits are entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && activeField === 'pin') {
      setActiveField('confirm');
    }
  }, [pin, activeField]);

  function handleBackspace() {
    if (activeField === 'pin') setPin((p) => p.slice(0, -1));
    else setConfirmPin((p) => p.slice(0, -1));
  }

  async function handleCreateAccount() {
    if (pin.length !== PIN_LENGTH) {
      return setError('PIN must be 6 digits');
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      setConfirmPin('');
      setActiveField('confirm');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Dynamic import to avoid SSR issues with crypto libs
      const { createPinAccount } = await import('@/lib/wallet');
      const key = await createPinAccount(pin);
      setPublicKey(key ?? '');
      setStep('recovery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create account. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-advance to confirm field when PIN is full
  function handlePinDotClick(field: 'pin' | 'confirm') {
    setActiveField(field);
  }

  if (step === 'recovery') {
    return (
      <RecoveryPhrase
        onConfirmed={() => {
          setStep('done');
          onComplete(publicKey);
        }}
        onBack={() => setStep('pin')}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-1">
        <div className="text-3xl">🔒</div>
        <h2 className="text-xl font-semibold text-gray-900">Set your vault PIN</h2>
        <p className="text-sm text-gray-500">
          Your 6-digit PIN is the key to your vault. It never leaves your device.
        </p>
      </div>

      {/* PIN dots */}
      <div className="space-y-4">
        {/* PIN field */}
        <div
          className={`space-y-2 cursor-pointer`}
          onClick={() => setActiveField('pin')}
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${activeField === 'pin' ? 'text-blue-600' : 'text-gray-400'}`}>
            Enter PIN
          </p>
          <div className="flex gap-3 justify-center">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                  i < pin.length
                    ? 'bg-blue-600 border-blue-600'
                    : activeField === 'pin'
                    ? 'border-blue-400'
                    : 'border-gray-300'
                }`}
              >
                {i < pin.length && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Confirm field — only shown once PIN is full */}
        {pin.length === PIN_LENGTH && (
          <div
            className="space-y-2 cursor-pointer"
            onClick={() => setActiveField('confirm')}
          >
            <p className={`text-xs font-medium uppercase tracking-wide ${activeField === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
              Confirm PIN
            </p>
            <div className="flex gap-3 justify-center">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                    i < confirmPin.length
                      ? confirmPin.length === PIN_LENGTH && confirmPin !== pin
                        ? 'bg-red-500 border-red-500'
                        : 'bg-blue-600 border-blue-600'
                      : activeField === 'confirm'
                      ? 'border-blue-400'
                      : 'border-gray-300'
                  }`}
                >
                  {i < confirmPin.length && (
                    <div className="w-3 h-3 rounded-full bg-white" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Numpad */}
      <div className="max-w-xs mx-auto">
        <div className="grid grid-cols-3 gap-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => (
            <button
                key={key}
                onClick={() => {
                if (key === '⌫') {
                    handleBackspace();
                } else if (key !== '') {
                    handleDigit(key);
                }
                }}
                disabled={key === ''}
                className={`aspect-square rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
                key === ''
                    ? 'opacity-0 pointer-events-none'
                    : key === '⌫'
                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
            >
                {key}
            </button>
            ))}
        </div>
    </div>

      {/* CTA */}
      <div className="space-y-3">
        <button
          onClick={handleCreateAccount}
          disabled={loading || pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
          className="w-full bg-blue-600 text-white rounded-2xl py-4 font-semibold text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {loading ? 'Creating your vault…' : 'Create vault'}
        </button>
        {onBack && (
          <button
            onClick={onBack}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            Back
          </button>
        )}
      </div>

      <p className="text-xs text-center text-gray-400">
        No ID required · No email needed · Stored only on your device
      </p>
    </div>
  );
}