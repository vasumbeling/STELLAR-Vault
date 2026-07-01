import { Keypair } from "@stellar/stellar-sdk"

const BASE_URL = "http://localhost:3000"

async function main() {
  const keypair = Keypair.random()
  const pubkey = keypair.publicKey()

  const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey }),
  })
  const { challenge } = await challengeRes.json()

  const challengeBuffer = Buffer.from(challenge, "utf8")
  const signatureBuffer = keypair.sign(challengeBuffer)
  const signature = signatureBuffer.toString("base64")

  console.log("First verify attempt (should succeed)...")
  const firstRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature }),
  })
  console.log("Status:", firstRes.status)
  console.log(await firstRes.json())

  console.log("\nSecond verify attempt with SAME signature (should fail — replay)...")
  const secondRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature }),
  })
  console.log("Status:", secondRes.status)
  console.log(await secondRes.json())

  if (secondRes.status === 400) {
    console.log("\n✅ CORRECT — replay was rejected")
  } else {
    console.log("\n❌ PROBLEM — replay should have been rejected but wasn't")
  }
}

main().catch(console.error)