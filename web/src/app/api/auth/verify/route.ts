import "dotenv/config"
import jwt from "jsonwebtoken"
import { Keypair } from "@stellar/stellar-sdk"
import { getChallenge, clearChallenge } from "@/lib/challengeStore"

export async function POST(request: Request) {
  const body = await request.json()
  const { pubkey, signature } = body

  if (!pubkey || !signature) {
    return Response.json(
      { error: "pubkey and signature are required" },
      { status: 400 }
    )
  }

  const challenge = await getChallenge(pubkey)

  if (!challenge) {
    return Response.json(
      { error: "No valid challenge found for this pubkey. Request a new one." },
      { status: 400 }
    )
  }

  let isValid = false
  try {
    const keypair = Keypair.fromPublicKey(pubkey)
    const challengeBuffer = Buffer.from(challenge, "utf8")
    const signatureBuffer = Buffer.from(signature, "base64")
    isValid = keypair.verify(challengeBuffer, signatureBuffer)
  } catch (error) {
    console.error("Signature verification error:", error)
    return Response.json({ error: "Invalid pubkey or signature format" }, { status: 400 })
  }

  if (!isValid) {
    return Response.json({ error: "Signature does not match" }, { status: 401 })
  }

  await clearChallenge(pubkey)

  const token = jwt.sign(
    { pubkey },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  )

  return Response.json({ token })
}