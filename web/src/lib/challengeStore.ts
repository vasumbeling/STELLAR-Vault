import { prisma } from "@/lib/prisma"

const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function saveChallenge(pubkey: string, challenge: string) {
  await prisma.challenge.upsert({
    where: { pubkey },
    update: {
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
    create: {
      pubkey,
      challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  })
}

export async function getChallenge(pubkey: string): Promise<string | null> {
  const entry = await prisma.challenge.findUnique({ where: { pubkey } })
  if (!entry) return null

  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.challenge.delete({ where: { pubkey } })
    return null
  }

  return entry.challenge
}

export async function clearChallenge(pubkey: string) {
  await prisma.challenge.delete({ where: { pubkey } }).catch(() => {})
}