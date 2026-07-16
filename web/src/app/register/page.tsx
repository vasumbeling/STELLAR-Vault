'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CreateAccount } from '@/components/auth/CreateAccount';
import { saveProfile } from '@/lib/auth/verification';
import { authFetch } from '@/lib/wallet';

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

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardStep>('intro');
  const [publicKey, setPublicKey] = useState('');

  // Profile fields -- Level 0 requirements
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('Philippines');
  const [phone, setPhone] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [profileError, setProfileError] = useState('');

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
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setDemoOtp(code);
    setResendCooldown(RESEND_COOLDOWN);
  }

  function handleProfileSubmit() {
    if (!displayName.trim()) return setProfileError('Display name is required');
    if (!phone.trim() || phone.length < 10) return setProfileError('A valid mobile number is required');
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

  async function handleVerifyOtp() {
    if (otpCode.length !== OTP_LENGTH) return;
    setOtpLoading(true);
    setOtpError('');
    setTimeout(finishOtpVerification, 600);
  }

  async function finishOtpVerification() {
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

    try {
      await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          pubkey: publicKey,
          username: displayName.trim(),
        }),
      });
    } catch {
      // Non-fatal -- the account still works locally even if this sync fails.
      // The user isn't blocked from finishing onboarding over a backend hiccup.
    }

    setOtpLoading(false);
    setStep('done');
    setTimeout(() => router.push('/'), 2000);
  }

  useEffect(() => {
    if (otpCode.length === OTP_LENGTH && !otpLoading) {
      handleVerifyOtp();
    }
  }, [otpCode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const STEP_ORDER: OnboardStep[] = ['pin', 'profile', 'otp'];

  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] text-slate-700 antialiased flex items-center justify-center py-6 px-4">
      {/* Structural Phone Container Frame */}
      <div className="w-full max-w-sm min-h-[820px] bg-[#FAF8F5] flex flex-col justify-between font-sans px-2 py-4">
        
        <div className="flex-1 flex flex-col justify-center">
          
          {/* Global Multi-step Progress Bar Indicator */}
          {step !== 'intro' && step !== 'done' && (
            <div className="flex gap-2 mb-8 px-1 w-full max-w-xs mx-auto">
              {STEP_ORDER.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    STEP_ORDER.indexOf(step) >= i ? 'bg-[#FF9F1C]' : 'bg-amber-100/40'
                  }`}
                />
              ))}
            </div>
          )}

          {/* INTRO STEP */}
          {step === 'intro' && (
            <div className="space-y-8 flex flex-col items-center">
              
              {/* Premium Floating Graphic Deck */}
              <div className="w-full relative px-2 max-w-[290px] mx-auto rounded-3xl overflow-hidden bg-[#FAF8F5] shadow-xs border border-amber-100/20">
                <div className="absolute inset-0 bg-gradient-to-b from-amber-50/20 to-transparent pointer-events-none" />
                <img 
                  src="stellamascot.png" 
                  alt="STELLA Mascot Vault" 
                  className="w-full h-auto object-contain mx-auto drop-shadow-[0_8px_24px_rgba(255,159,28,0.12)]"
                />
              </div>

              {/* Exact Copy Frame Headlines */}
              <div className="text-center space-y-4 max-w-xs px-2 mx-auto">
                <h2 className="text-[26px] font-semibold text-slate-800 tracking-tight leading-tight">
                  Save money that keeps its value.
                </h2>
                <p className="text-sm font-normal text-slate-400 leading-relaxed px-1">
                  Save anytime, from any amount, and protect your savings from losing value over time.
                </p>
              </div>

              {/* CTA Action Deck Buttons */}
              <div className="w-full max-w-xs space-y-3 px-2 pt-2">
                <button
                  onClick={() => setStep('pin')}
                  className="w-full bg-[#FF9F1C] hover:bg-[#FF8C00] text-white rounded-xl py-3.5 text-sm font-medium tracking-wide shadow-xs active:scale-98 transition-all"
                >
                  Sign up
                </button>
                
                <button
                  onClick={() => router.push('/login')}
                  className="w-full bg-white border border-amber-100/60 text-slate-600 rounded-xl py-3.5 text-sm font-medium tracking-wide hover:bg-amber-50/10 active:scale-98 transition-all"
                >
                  Log in
                </button>
              </div>
            </div>
          )}

          {/* PIN GENERATOR ACCORDION STEP */}
          {step === 'pin' && (
            <div className="w-full max-w-xs mx-auto animate-fade-in">
              <CreateAccount
                onComplete={handleAccountCreated}
                onBack={() => setStep('intro')}
              />
            </div>
          )}

          {/* PROFILE DATA ACCORDION STEP */}
          {step === 'profile' && (
            <div className="w-full max-w-xs mx-auto space-y-6 animate-fade-in">
              <div className="text-center space-y-1.5">
                <div className="relative mx-auto mb-2 w-14 h-14">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-14 h-14 rounded-xl bg-white text-slate-400 flex items-center justify-center overflow-hidden border border-amber-100/40 shadow-xs"
                  >
                    {profilePicture ? (
                      <img src={profilePicture} alt="Profile Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Set up your profile</h3>
                <p className="text-xs font-normal text-slate-400">A friendly nickname is fine.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Display name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ate Maria"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Country</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-300"
                  >
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Phone number</label>
                  <div className="flex gap-2">
                    <span className="border border-slate-200 rounded-xl px-3 py-3 text-xs font-medium bg-slate-50 text-slate-500 flex items-center">
                      +63
                    </span>
                    <input
                      type="tel"
                      placeholder="9XX XXX XXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-300"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-amber-200 text-[#FF9F1C] focus:ring-transparent"
                />
                <span className="text-[11px] font-normal text-slate-400 leading-normal">
                  I agree to the <span className="text-[#FF9F1C] font-medium underline">Terms</span> and understand STELLA Vault is fully non-custodial.
                </span>
              </label>

              {profileError && (
                <p className="text-red-500 text-[11px] text-center font-medium bg-red-50/60 border border-red-100/50 rounded-xl py-2 px-3">{profileError}</p>
              )}

              <button
                onClick={handleProfileSubmit}
                disabled={!displayName.trim() || !tosAccepted}
                className="w-full bg-[#FF9F1C] text-white rounded-xl py-3.5 text-sm font-medium disabled:opacity-40 hover:bg-[#FF8C00] transition-colors"
              >
                Send verification code
              </button>
            </div>
          )}

          {/* OTP HANDSHAKE ACCORDION STEP */}
          {step === 'otp' && (
            <div className="w-full max-w-xs mx-auto space-y-6 animate-fade-in">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Verify number</h3>
                <p className="text-xs font-normal text-slate-400">Sent a verification payload to +63 {phone}</p>
              </div>

              <div className="bg-cyan-50/50 border border-cyan-100/50 rounded-xl py-2 px-4 text-center">
                <p className="text-[9px] font-semibold text-cyan-700 uppercase tracking-widest font-mono">Demo payload code</p>
                <p className="text-base font-semibold tracking-widest text-cyan-800 font-mono mt-0.5">{demoOtp}</p>
              </div>

              {/* Status Indicators */}
              <div className="flex gap-3 justify-center py-2">
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${
                      i < otpCode.length
                        ? otpError
                          ? 'bg-red-400 border-red-400'
                          : 'bg-[#FF9F1C] border-[#FF9F1C]'
                        : 'border-amber-200 bg-transparent'
                    }`}
                  />
                ))}
              </div>

              {/* Grid Number Input Pad Layout */}
              <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'X'].map((key, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (key === 'âŒ«') handleOtpBackspace();
                      else if (key !== '') handleOtpDigit(key);
                    }}
                    disabled={key === '' || otpLoading}
                    className={`h-11 rounded-xl text-base font-medium flex items-center justify-center transition-all ${
                      key === ''
                        ? 'opacity-0 pointer-events-none'
                        : key === 'âŒ«'
                        ? 'text-slate-400 active:scale-95'
                        : 'bg-white border border-amber-100/30 text-slate-600 active:scale-95'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  onClick={generateAndSendOtp}
                  disabled={resendCooldown > 0}
                  className="text-xs font-medium text-[#FF9F1C] disabled:text-slate-300 transition-colors"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
                <button onClick={() => setStep('profile')} className="text-xs font-medium text-slate-400 py-1">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS FINALIZE STEP */}
          {step === 'done' && (
            <div className="w-full max-w-xs mx-auto text-center space-y-4 py-8 animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center mx-auto text-cyan-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Account created!</h3>
              <p className="text-xs font-normal text-slate-400 leading-relaxed px-4">
                Welcome, {displayName}. Unlocking your STELLA Vault.
              </p>
            </div>
          )}

        </div>

        {/* Brand System Footer Deck Layout */}
        <div className="flex flex-col items-center space-y-4 pt-12">
          <span className="text-[10px] font-normal text-slate-400 tracking-normal">
            © 2026 Team Ada's Lovelies. All rights reserved.
          </span>
        </div>

      </div>
    </main>
  );
}
