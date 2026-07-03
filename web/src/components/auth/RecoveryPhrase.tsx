// 12-word backup if mawala ang pin

'use client';

import { useState, useEffect } from 'react';

// Minimal BIP-39 wordlist subset for demo — replace with full list in production
// In production: import { generateMnemonic } from 'bip39'
const WORD_SAMPLE = [
  'abandon','ability','able','about','above','absent','absorb','abstract',
  'absurd','abuse','access','accident','account','accuse','achieve','acid',
  'acoustic','acquire','across','action','actor','actual','adapt','add',
  'addict','address','adjust','admit','adult','advance','advice','aerobic',
  'afford','afraid','again','agent','agree','ahead','aim','air','airport',
  'aisle','alarm','album','alcohol','alert','alien','alley','allow','almost',
  'alone','alpha','already','also','alter','always','amateur','amazing',
  'among','amount','amused','analyst','anchor','ancient','anger','angle',
  'angry','animal','ankle','announce','annual','another','answer','antenna',
  'antique','anxiety','apart','april','arch','arctic','area','arena',
];

function generatePhrase(): string[] {
  const words: string[] = [];
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) {
    words.push(WORD_SAMPLE[arr[i] % WORD_SAMPLE.length]);
  }
  return words;
}

interface RecoveryPhraseProps {
  onConfirmed: () => void;
  onBack: () => void;
}

export function RecoveryPhrase({ onConfirmed, onBack }: RecoveryPhraseProps) {
  const [phrase, setPhrase] = useState<string[]>([]);
  const [step, setStep] = useState<'show' | 'verify'>('show');
  const [copied, setCopied] = useState(false);
  const [written, setWritten] = useState(false);

  // Verification: pick 3 random word indices to confirm
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({});
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    const generated = generatePhrase();
    setPhrase(generated);
    // Pick 3 random indices for verification
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * 12));
    }
    setVerifyIndices([...indices].sort((a, b) => a - b));
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(phrase.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleVerify() {
    setVerifyError('');
    for (const idx of verifyIndices) {
      if ((verifyInputs[idx] ?? '').trim().toLowerCase() !== phrase[idx]) {
        setVerifyError(`Word #${idx + 1} doesn't match. Check your backup.`);
        return;
      }
    }
    onConfirmed();
  }

  if (phrase.length === 0) return null;

  return (
    <div className="space-y-6">
      {step === 'show' ? (
        <>
          <div className="text-center space-y-1">
            <div className="text-3xl">🔑</div>
            <h2 className="text-xl font-semibold text-gray-900">Your Recovery Phrase</h2>
            <p className="text-sm text-gray-500">
              Write these 12 words down in order. This is the only way to recover your vault
              if you forget your PIN or lose your device.
            </p>
          </div>

          {/* Warning banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            ⚠️ Never share this phrase. Anyone with these words controls your vault.
          </div>

          {/* Word grid */}
          <div className="grid grid-cols-3 gap-2">
            {phrase.map((word, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                <span className="text-sm font-medium text-gray-800">{word}</span>
              </div>
            ))}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="w-full border border-gray-300 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {copied ? '✓ Copied to clipboard' : 'Copy to clipboard'}
          </button>

          {/* Written down checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={written}
              onChange={(e) => setWritten(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            <span className="text-sm text-gray-600">
              I have written down all 12 words in the correct order and stored them safely.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => setStep('verify')}
              disabled={!written}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              I've saved it
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center space-y-1">
            <div className="text-3xl">✅</div>
            <h2 className="text-xl font-semibold text-gray-900">Confirm your backup</h2>
            <p className="text-sm text-gray-500">
              Enter the words at the positions below to confirm you've saved your phrase.
            </p>
          </div>

          <div className="space-y-3">
            {verifyIndices.map((idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Word #{idx + 1}
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={verifyInputs[idx] ?? ''}
                  onChange={(e) =>
                    setVerifyInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter word #${idx + 1}`}
                />
              </div>
            ))}
          </div>

          {verifyError && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{verifyError}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('show')}
              className="flex-1 border border-gray-300 rounded-xl py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={verifyIndices.some((idx) => !(verifyInputs[idx] ?? '').trim())}
              className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}