import "dotenv/config"
import { randomBytes } from "crypto"
import { saveChallenge } from "@/lib/challengeStore"

export async function POST(request: Request) {
  const body = await request.json()
  const { pubkey } = body

  if (!pubkey) {
    return Response.json({ error: "pubkey is required" }, { status: 400 })
  }

  const randomPart = randomBytes(16).toString("hex")
  const challenge = `STELLA Vault auth challenge: ${randomPart}`

  await saveChallenge(pubkey, challenge)

  return Response.json({ challenge })
}
