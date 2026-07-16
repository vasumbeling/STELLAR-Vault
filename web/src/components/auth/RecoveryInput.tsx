'use client';

import { useState } from 'react';
import { deriveFromMnemonic } from '@/lib/auth/recovery';

interface RecoveryInputProps {
  onRecovered: () => void;
  onBack: () => void;
}

const PIN_LENGTH = 6;

export function RecoveryInput({ onRecovered, onBack }: RecoveryInputProps) {
  const [step, setStep] = useState<'phrase' | 'pin'>('phrase');
  const [phraseText, setPhraseText] = useState('');
  const [derivedSecret, setDerivedSecret] = useState<{ publicKey: string } | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleContinueFromPhrase() {
    setError('');
    try {
      const { publicKey } = deriveFromMnemonic(phraseText);
      setDerivedSecret({ publicKey });
      setStep('pin');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid recovery phrase.');
    }
  }

  async function handleSetNewPin() {
    setError('');
    if (pin.length !== PIN_LENGTH) {
      setError(`PIN must be ${PIN_LENGTH} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }

    setLoading(true);
    try {
      const { recoverPinAccount } = await import('@/lib/wallet');
      await recoverPinAccount(phraseText, pin);
      onRecovered();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recovery failed. Please check your phrase and try again.');
      setStep('phrase'); // send them back to re-check the phrase
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 bg-[#FAF8F5] select-none text-slate-700">
      {step === 'phrase' ? (
        <>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Recover your vault</h2>
            <p className="text-xs font-normal text-slate-400 max-w-xs mx-auto leading-relaxed">
              Enter your 12 or 24-word recovery phrase, separated by spaces.
            </p>
          </div>

          <textarea
            value={phraseText}
            onChange={(e) => setPhraseText(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            rows={4}
            placeholder="word1 word2 word3 ..."
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium focus:outline-none focus:border-cyan-400 transition-colors placeholder-slate-300 resize-none"
          />

          {error && (
            <p className="text-red-500 text-xs font-medium bg-red-50/40 border border-red-100/40 rounded-xl py-2 px-4">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onBack}
              className="flex-1 border border-slate-200 bg-white rounded-xl py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleContinueFromPhrase}
              disabled={!phraseText.trim()}
              className={`flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                phraseText.trim()
                  ? 'bg-linear-to-r from-orange-500 to-[#FF5E00] text-white shadow-sm shadow-orange-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Set a new PIN</h2>
            <p className="text-xs font-normal text-slate-400 max-w-xs mx-auto leading-relaxed">
              Choose a {PIN_LENGTH}-digit PIN to unlock this vault going forward.
              {derivedSecret && (
                <span className="block mt-1 font-mono text-[10px] text-slate-400">
                  {derivedSecret.publicKey.slice(0, 6)}…{derivedSecret.publicKey.slice(-6)}
                </span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="New PIN"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-semibold tracking-[0.5em] text-center focus:outline-none focus:border-cyan-400 transition-colors placeholder-slate-300 placeholder:tracking-normal"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm PIN"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-semibold tracking-[0.5em] text-center focus:outline-none focus:border-cyan-400 transition-colors placeholder-slate-300 placeholder:tracking-normal"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs font-medium bg-red-50/40 border border-red-100/40 rounded-xl py-2 px-4">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('phrase')}
              disabled={loading}
              className="flex-1 border border-slate-200 bg-white rounded-xl py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleSetNewPin}
              disabled={loading || pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
              className={`flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                !loading && pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH
                  ? 'bg-linear-to-r from-orange-500 to-[#FF5E00] text-white shadow-sm shadow-orange-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? 'Recovering…' : 'Recover vault'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}