'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CreateAccount } from '@/components/auth/CreateAccount';
import { saveProfile } from '@/lib/auth/verification';

type OnboardStep = 'intro' | 'pin' | 'profile' | 'otp' | 'done';

const COUNTRIES = [
  'Philippines',
  'United States',
  'Saudi Arabia',
  'United Arab Emirates',
  'Singapore',
  'Canada',
  'Australia',
  'Other',
];

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

/* ---------- Pure Inline Decorative Icons (matches dashboard) ---------- */
function SparkleStar({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2c0 4.2 1.2 7 3.2 9S22 12.8 22 12s-4.8-.8-6.8-2.8S12 2 12 2z" fill="currentColor" />
      <path d="M12 22c0-4.2-1.2-7-3.2-9S2 11.2 2 12s4.8.8 6.8 2.8S12 22 12 22z" fill="currentColor" />
    </svg>
  );
}

function LockIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
    </svg>
  );
}

function CoinIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5-1.3 2-3 2.5-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5"></path>
    </svg>
  );
}

function GroupIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="8" r="3"></circle>
      <circle cx="17" cy="9" r="2.5"></circle>
      <path d="M3 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"></path>
      <path d="M15 15.2c2.6.3 4.5 2.2 4.5 4.8"></path>
    </svg>
  );
}

function BoltIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"></path>
    </svg>
  );
}

function PhoneIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="2" width="12" height="20" rx="2"></rect>
      <line x1="10" y1="18" x2="14" y2="18"></line>
    </svg>
  );
}

function CameraIcon({ className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>
      <circle cx="12" cy="13" r="3.5"></circle>
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardStep>('intro');
  const [publicKey, setPublicKey] = useState('');

  // Profile fields — Level 0 requirements per Progressive Identity Verification framework
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [phone, setPhone] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Optional Level 0 fields
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OTP verification state
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  function handleAccountCreated(key: string) {
    setPublicKey(key);
    setStep('profile');
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfilePicture(reader.result as string);
    reader.readAsDataURL(file);
  }

  function generateAndSendOtp() {
    // Demo-only: real implementation would call an SMS provider (e.g. Twilio) here.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setDemoOtp(code);
    setResendCooldown(RESEND_COOLDOWN);
  }

  function handleProfileSubmit() {
    if (!displayName.trim()) return setProfileError('Display name is required');
    if (!phone.trim() || phone.length < 10) return setProfileError('A valid mobile number is required for OTP verification');
    if (!tosAccepted) return setProfileError('Please accept the terms to continue');
    setProfileError('');

    generateAndSendOtp();
    setOtpCode('');
    setOtpError('');
    setStep('otp');
  }

  function handleOtpDigit(digit: string) {
    if (otpCode.length < OTP_LENGTH) {
      setOtpCode((c) => c + digit);
      setOtpError('');
    }
  }

  function handleOtpBackspace() {
    setOtpCode((c) => c.slice(0, -1));
    setOtpError('');
  }

  function handleVerifyOtp() {
    if (otpCode.length !== OTP_LENGTH) return;
    setOtpLoading(true);
    setOtpError('');

    // Demo-only verification against the locally generated code.
    setTimeout(() => {
      if (otpCode !== demoOtp) {
        setOtpError('Incorrect code. Please try again.');
        setOtpCode('');
        setOtpLoading(false);
        return;
      }

      saveProfile({
        displayName: displayName.trim(),
        country,
        phoneNumber: phone,
        phoneVerified: true,
        tosAccepted: true,
        email: email || undefined,
        verificationLevel: 0,
        createdAt: new Date().toISOString(),
      });

      setOtpLoading(false);
      setStep('done');
      setTimeout(() => router.push('/'), 2000);
    }, 600);
  }

  // Auto-verify once all 6 digits are entered
  useEffect(() => {
    if (otpCode.length === OTP_LENGTH && !otpLoading) {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpCode]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const STEP_ORDER: OnboardStep[] = ['pin', 'profile', 'otp'];

  return (
    <main className="min-h-screen w-full bg-[#FAF6F0] text-slate-800 antialiased selection:bg-[#6C5DD3]/10 flex items-center justify-center py-8 px-4">

      {/* Phone frame container — matches live dashboard DOM */}
      <div className="w-full max-w-md min-h-[880px] bg-[#F9F8FE] rounded-[3rem] overflow-hidden shadow-2xl relative flex flex-col justify-between font-sans border border-slate-100/80">

      <div className="flex-1 overflow-y-auto px-4 py-12">

        {/* Core Header Section */}
        <header className="mb-6 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#6C5DD3] rounded-xl text-white">
              <SparkleStar className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">STELLA Vault</h1>
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
            Soroban Engine · Smart Testnet
          </p>

          {/* Step progress dots */}
          {step !== 'intro' && step !== 'done' && (
            <div className="flex gap-1.5 mt-5">
              {STEP_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    STEP_ORDER.indexOf(step) >= i ? 'bg-[#6C5DD3]' : 'bg-violet-100'
                  }`}
                />
              ))}
            </div>
          )}
        </header>

        {/* Intro */}
        {step === 'intro' && (
          <div className="space-y-5">
            <section className="rounded-4xl border border-violet-100/50 bg-white p-6 shadow-xl shadow-indigo-900/5">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
                Save together,<br />grow together
              </h2>
              <p className="text-xs font-medium text-slate-400 leading-relaxed mt-2">
                A digital paluwagan built on Stellar. No government ID required to get started.
              </p>
            </section>

            <div className="space-y-2.5">
              {[
                { Icon: LockIcon, title: 'PIN-protected', desc: 'Your vault is locked with a PIN only you know' },
                { Icon: PhoneIcon, title: 'Phone + OTP verified', desc: 'Just your mobile number — no bank or ID needed' },
                { Icon: CoinIcon, title: 'Save in USDC', desc: 'Beat peso inflation with stable USD savings' },
                { Icon: GroupIcon, title: 'Paluwagan circles', desc: 'Join or create group savings with your community' },
                { Icon: BoltIcon, title: 'No government ID', desc: 'Level 0 requires only a PIN, nickname, and phone' },
              ].map(({ Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-4xl border border-violet-100/50 bg-white p-4 shadow-xl shadow-indigo-900/5"
                >
                  <div className="p-1.5 bg-indigo-50 rounded-xl text-[#6C5DD3] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700 tracking-tight">{title}</p>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('pin')}
              className="w-full bg-[#6C5DD3] text-white rounded-2xl py-4 text-sm font-black tracking-tight hover:bg-[#5B4FBF] transition-colors"
            >
              Create my vault
            </button>

            <p className="text-center text-xs font-medium text-slate-400">
              Already have a vault?{' '}
              <button
                onClick={() => router.push('/login')}
                className="font-black text-[#6C5DD3] hover:underline"
              >
                Log in
              </button>
            </p>
          </div>
        )}

        {/* PIN + Recovery */}
        {step === 'pin' && (
          <section className="rounded-4xl border border-violet-100/50 bg-white p-6 shadow-xl shadow-indigo-900/5">
            <CreateAccount
              onComplete={handleAccountCreated}
              onBack={() => setStep('intro')}
            />
          </section>
        )}

        {/* Profile */}
        {step === 'profile' && (
          <div className="space-y-5">
            <section className="rounded-4xl border border-violet-100/50 bg-white p-6 shadow-xl shadow-indigo-900/5 space-y-6">
              <div className="text-center space-y-1">
                {/* Optional profile picture */}
                <div className="relative mx-auto mb-1 w-16 h-16">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-2xl bg-indigo-50 text-[#6C5DD3] flex items-center justify-center overflow-hidden border border-violet-100"
                  >
                    {profilePicture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <CameraIcon className="h-6 w-6" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Set up your profile</h2>
                <p className="text-[11px] font-medium text-slate-400">No real name required — a nickname is fine.</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Display name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ate Maria or Kuya Jun"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    className="w-full border border-violet-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/30 focus:border-[#6C5DD3]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full border border-violet-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/30 focus:border-[#6C5DD3]"
                  >
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Phone number * <span className="normal-case text-slate-300">(we&apos;ll text you a code)</span>
                  </label>
                  <div className="flex gap-2">
                    <span className="border border-violet-100 rounded-xl px-3 py-3 text-sm font-medium bg-indigo-50/60 text-slate-600">
                      🇵🇭 +63
                    </span>
                    <input
                      type="tel"
                      placeholder="9XX XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="flex-1 border border-violet-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/30 focus:border-[#6C5DD3]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Email <span className="normal-case text-slate-300">(optional)</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-violet-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/30 focus:border-[#6C5DD3]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Referral code <span className="normal-case text-slate-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JUAN2026"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="w-full border border-violet-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6C5DD3]/30 focus:border-[#6C5DD3]"
                  />
                </div>
              </div>

              {/* Level 0 restrictions notice */}
              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3 space-y-1">
                <p className="text-xs font-black text-[#5B4FBF] tracking-tight">Level 0 — Basic Account</p>
                <ul className="text-[11px] font-medium text-[#6C5DD3]/80 space-y-0.5 list-disc list-inside">
                  <li>Create and join paluwagan circles</li>
                  <li>Deposit and receive USDC</li>
                  <li>Lower transaction/value limits apply</li>
                  <li>Cannot cash out to PHP yet — upgrade to Level 1 or 2 later</li>
                </ul>
              </div>

              {/* ToS */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-violet-200 accent-[#6C5DD3]"
                />
                <span className="text-[11px] font-medium text-slate-400 leading-relaxed">
                  I agree to the{' '}
                  <a href="/terms" className="text-[#6C5DD3] font-bold underline">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" className="text-[#6C5DD3] font-bold underline">Privacy Policy</a>.
                  I understand STELLA Vault is non-custodial and I am responsible for my PIN and recovery phrase.
                </span>
              </label>

              {profileError && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
                  <p className="text-[11px] font-bold text-rose-600 leading-normal">{profileError}</p>
                </div>
              )}

              <button
                onClick={handleProfileSubmit}
                disabled={!displayName.trim() || !tosAccepted}
                className="w-full bg-[#6C5DD3] text-white rounded-2xl py-4 text-sm font-black tracking-tight disabled:opacity-40 hover:bg-[#5B4FBF] transition-colors"
              >
                Send verification code
              </button>
            </section>
          </div>
        )}

        {/* OTP Verification — Level 0 requirement: mobile phone number with OTP verification */}
        {step === 'otp' && (
          <section className="rounded-4xl border border-violet-100/50 bg-white p-6 shadow-xl shadow-indigo-900/5">
            <div className="space-y-8">
              <div className="text-center space-y-1">
                <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[#6C5DD3]">
                  <PhoneIcon className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Verify your number</h2>
                <p className="text-[11px] font-medium text-slate-400">
                  We sent a {OTP_LENGTH}-digit code to +63 {phone || '9XX XXX XXXX'}
                </p>
              </div>

              {/* Demo hint — no live SMS provider wired up yet */}
              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-100 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#6C5DD3]/70">Testnet demo code</p>
                <p className="text-lg font-black tracking-[0.3em] text-[#5B4FBF] mt-0.5">{demoOtp}</p>
              </div>

              {/* OTP dots */}
              <div className="flex gap-3 justify-center">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all ${
                      i < otpCode.length
                        ? otpError
                          ? 'bg-red-500 border-red-500'
                          : 'bg-[#6C5DD3] border-[#6C5DD3]'
                        : 'border-violet-200'
                    }`}
                  >
                    {i < otpCode.length && <div className="w-3 h-3 rounded-full bg-white" />}
                  </div>
                ))}
              </div>

              {otpError && (
                <p className="text-red-500 text-sm text-center bg-red-50 rounded-lg px-3 py-2 -mt-4">
                  {otpError}
                </p>
              )}

              {otpLoading && (
                <p className="text-[#6C5DD3] text-sm text-center -mt-4">Verifying…</p>
              )}

              {/* Numpad */}
              <div className="max-w-xs mx-auto">
                <div className="grid grid-cols-3 gap-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (key === '⌫') handleOtpBackspace();
                        else if (key !== '') handleOtpDigit(key);
                      }}
                      disabled={key === '' || otpLoading}
                      className={`aspect-square rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
                        key === ''
                          ? 'opacity-0 pointer-events-none'
                          : 'bg-indigo-50 text-slate-800 hover:bg-indigo-100'
                      }`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={generateAndSendOtp}
                  disabled={resendCooldown > 0}
                  className="w-full text-sm font-bold text-[#6C5DD3] disabled:text-slate-300 py-2 transition-colors"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button
                  onClick={() => setStep('profile')}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
                >
                  Back
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Done */}
        {step === 'done' && (
          <section className="rounded-4xl border border-violet-100/50 bg-white py-16 px-6 shadow-xl shadow-indigo-900/5 flex flex-col items-center justify-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-[#6C5DD3]">
              <SparkleStar className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Vault created!</h2>
            <p className="text-xs font-medium text-slate-400 text-center leading-relaxed">
              Welcome to STELLA Vault, {displayName}. Taking you to your dashboard…
            </p>
            <div className="w-8 h-8 border-2 border-[#6C5DD3] border-t-transparent rounded-full animate-spin mt-2" />
          </section>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-[10px] font-semibold tracking-wide text-slate-400 px-4 leading-relaxed">
          Built by Team Ada&apos;s Lovelies
          <br />
          <span className="opacity-75 font-normal">One secure vault and one community at a time.</span>
        </footer>

      </div>
      </div>
    </main>
  );
}