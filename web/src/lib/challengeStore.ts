type ChallengeEntry = {
  challenge: string;
  expiresAt: number;
};

const challenges = new Map<string, ChallengeEntry>();

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function saveChallenge(pubkey: string, challenge: string) {
  challenges.set(pubkey, {
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function getChallenge(pubkey: string): string | null {
  const entry = challenges.get(pubkey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    challenges.delete(pubkey);
    return null;
  }

  return entry.challenge;
}

export function clearChallenge(pubkey: string) {
  challenges.delete(pubkey);
}