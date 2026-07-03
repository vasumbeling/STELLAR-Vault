export type VerificationLevel = 0 | 1 | 2;

export interface UserProfile {
  // Level 0 — required
  displayName: string;
  country: string;
  phoneNumber: string;
  phoneVerified: boolean;
  tosAccepted: boolean;

  // Level 0 — optional
  email?: string;
  profilePicture?: string;
  referralCode?: string;

  // Level 1 — alternative identity
  alternativeIdType?:
    | 'school_id'
    | 'employer_id'
    | 'cooperative_id'
    | 'barangay_cert'
    | 'endorsement';
  alternativeIdVerified?: boolean;
  selfieVerified?: boolean;

  // Level 2 — full KYC
  governmentIdVerified?: boolean;
  kycPartner?: string;

  // Meta
  verificationLevel: VerificationLevel;
  createdAt: string;
}

export interface TrustScore {
  score: number;                  // 0–100
  savingsGoalsCompleted: number;
  onTimeDeposits: number;
  collaborativeVaults: number;
  disputes: number;
  accountAgeMonths: number;
}

const PROFILE_KEY = 'stella_vault_profile';
const TRUST_KEY = 'stella_vault_trust';

// ─── Profile ────────────────────────────────────────────────────────────────

export function saveProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

export function updateProfile(patch: Partial<UserProfile>): UserProfile | null {
  const existing = loadProfile();
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  saveProfile(updated);
  return updated;
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(PROFILE_KEY);
}

export function getVerificationLevel(): VerificationLevel {
  return loadProfile()?.verificationLevel ?? 0;
}

export function hasProfile(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PROFILE_KEY) !== null;
}

// ─── Trust Score ─────────────────────────────────────────────────────────────

export function loadTrustScore(): TrustScore {
  if (typeof window === 'undefined') {
    return defaultTrustScore();
  }
  const raw = localStorage.getItem(TRUST_KEY);
  return raw ? (JSON.parse(raw) as TrustScore) : defaultTrustScore();
}

function defaultTrustScore(): TrustScore {
  return {
    score: 0,
    savingsGoalsCompleted: 0,
    onTimeDeposits: 0,
    collaborativeVaults: 0,
    disputes: 0,
    accountAgeMonths: 0,
  };
}

export function computeTrustScore(data: Omit<TrustScore, 'score'>): number {
  let score = 0;
  score += Math.min(data.savingsGoalsCompleted * 8, 30);  // max 30 pts
  score += Math.min(data.onTimeDeposits * 2, 20);         // max 20 pts
  score += Math.min(data.collaborativeVaults * 5, 25);    // max 25 pts
  score += Math.min(data.accountAgeMonths * 1, 15);       // max 15 pts
  score -= data.disputes * 15;                             // penalty per dispute
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function updateTrustScore(
  patch: Partial<Omit<TrustScore, 'score'>>,
): TrustScore {
  if (typeof window === 'undefined') return defaultTrustScore();
  const existing = loadTrustScore();
  const merged = { ...existing, ...patch };
  const updated: TrustScore = {
    ...merged,
    score: computeTrustScore(merged),
  };
  localStorage.setItem(TRUST_KEY, JSON.stringify(updated));
  return updated;
}

export function clearTrustScore(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRUST_KEY);
}

// ─── Feature gates by level ──────────────────────────────────────────────────

export const LEVEL_FEATURES = {
  0: [
    'Create personal savings vaults',
    'Join collaborative vaults (paluwagan)',
    'Deposit and receive USDC',
    'View vault balances and progress',
  ],
  1: [
    'Higher transaction limits',
    'Create more and larger collaborative vaults',
    'Verified badge on your profile',
    'Build a platform trust score',
  ],
  2: [
    'Cash out USDC to Philippine Pesos (PHP)',
    'Withdraw to banks or e-wallets',
    'Cross-border remittance settlement',
    'Access to regulated financial products',
  ],
} as const;

// ─── Level upgrade requirements ──────────────────────────────────────────────

export const LEVEL_REQUIREMENTS = {
  0: ['PIN authentication', 'Display name or nickname', 'Accept Terms of Service'],
  1: [
    'Verified mobile number',
    'One of: School ID, Employer ID, Barangay Certificate, or Community Endorsement',
    'Selfie with liveness detection',
  ],
  2: [
    'Government-issued ID',
    'Selfie / liveness verification',
    'Complete KYC through a licensed partner (e.g. PeraHub, Coins.ph)',
  ],
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns true if the user can access a feature gated at `requiredLevel` */
export function canAccess(requiredLevel: VerificationLevel): boolean {
  return getVerificationLevel() >= requiredLevel;
}

/** Clear all auth-related local storage (use on full logout) */
export function clearAllAuthData(): void {
  clearProfile();
  clearTrustScore();
}