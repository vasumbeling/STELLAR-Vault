'use client';

import { useState, useEffect } from 'react';

interface RecoveryPhraseProps {
  /** The real BIP-39 mnemonic generated for this account (from stellar.ts's generateKeypair). */
  mnemonic: string;
  onConfirmed: () => void;
  onBack: () => void;
}

export function RecoveryPhrase({ mnemonic, onConfirmed, onBack }: RecoveryPhraseProps) {
  const [phrase, setPhrase] = useState<string[]>([]);
  const [step, setStep] = useState<'show' | 'verify'>('show');
  const [copied, setCopied] = useState(false);
  const [written, setWritten] = useState(false);

  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [verifyInputs, setVerifyInputs] = useState<Record<number, string>>({});
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    const words = mnemonic.trim().split(/\s+/);
    setPhrase(words);
    const indices = new Set<number>();
    const sampleSize = Math.min(3, words.length);
    while (indices.size < sampleSize) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    setVerifyIndices([...indices].sort((a, b) => a - b));
  }, [mnemonic]);

  async function handleCopy() {
    await navigator.clipboard.writeText(phrase.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleVerify() {
    setVerifyError('');
    for (const idx of verifyIndices) {
      if ((verifyInputs[idx] ?? '').trim().toLowerCase() !== phrase[idx]) {
        setVerifyError(`Word #${idx + 1} doesn't match your backup layout.`);
        return;
      }
    }
    onConfirmed();
  }

  if (phrase.length === 0) return null;

  return (
    <div className="space-y-6 bg-[#FAF8F5] select-none text-slate-700">
      {step === 'show' ? (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-full bg-white flex items-center justify-center shadow-xs border border-amber-100/40">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H3.75v-2.25A2.25 2.25 0 013 18.125V15.75m9.155-2.423a4.5 4.5 0 115.344-5.344" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Your Secret Backup Phrase</h2>
            <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto leading-relaxed">
              Write these {phrase.length} words down in exact sequence. This is your only way to recover this account.
            </p>
          </div>

          {/* Elegant Amber Warning Card */}
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3.5 text-xs font-medium text-amber-800/90 leading-relaxed">
            ⚠️ Never share this phrase with anyone. These words grant sovereign control over your secure vault keys.
          </div>

          {/* Word Grid */}
          <div className="grid grid-cols-3 gap-2">
            {phrase.map((word, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-white border border-amber-100/30 rounded-xl px-2.5 py-2 shadow-xs"
              >
                <span className="text-[10px] font-bold font-mono text-cyan-600 bg-cyan-50/60 px-1 rounded-sm w-4 text-center">{i + 1}</span>
                <span className="text-sm font-semibold text-slate-700">{word}</span>
              </div>
            ))}
          </div>

          {/* Copy Trigger */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full border border-amber-200/80 bg-white rounded-xl py-2.5 text-xs font-bold text-slate-600 hover:bg-amber-50/20 transition-all font-mono uppercase tracking-wider"
          >
            {copied ? '✓ Copied to clipboard' : 'Copy recovery phrase'}
          </button>

          {/* Acknowledgment Verification */}
          <label className="flex items-start gap-3 cursor-pointer p-1">
            <input
              type="checkbox"
              checked={written}
              onChange={(e) => setWritten(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-amber-300 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-xs font-medium text-slate-400 leading-normal">
              I have written down all {phrase.length} words in the correct order and stored them safely offline.
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onBack}
              className="flex-1 border border-slate-200 bg-white rounded-xl py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('verify')}
              disabled={!written}
              className={`flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                written 
                  ? 'bg-linear-to-r from-orange-500 to-[#FF5E00] text-white shadow-sm shadow-orange-200' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              I've saved it
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-full bg-white flex items-center justify-center shadow-xs border border-amber-100/40">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Confirm backup payload</h2>
            <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto leading-relaxed">
              Verify your key positions to activate device state.
            </p>
          </div>

          <div className="space-y-3.5">
            {verifyIndices.map((idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="text-[10px] font-bold text-cyan-700 bg-cyan-50/80 px-2 py-0.5 border border-cyan-100/40 rounded-md font-mono uppercase tracking-wider inline-block">
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
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-semibold focus:outline-none focus:border-cyan-400 transition-colors placeholder-slate-300"
                  placeholder={`Enter word #${idx + 1}`}
                />
              </div>
            ))}
          </div>

          {verifyError && (
            <p className="text-red-500 text-xs font-semibold bg-red-50 border border-red-100/50 rounded-xl px-4 py-2.5">{verifyError}</p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setStep('show')}
              className="flex-1 border border-slate-200 bg-white rounded-xl py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleVerify}
              disabled={verifyIndices.some((idx) => !(verifyInputs[idx] ?? '').trim())}
              className={`flex-1 py-3 rounded-xl font-bold text-sm text-center transition-all ${
                !verifyIndices.some((idx) => !(verifyInputs[idx] ?? '').trim())
                  ? 'bg-linear-to-r from-orange-500 to-[#FF5E00] text-white shadow-sm shadow-orange-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Confirm
            </button>
          </div>
        </>
      )}
    </div>
  );
}