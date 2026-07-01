import { Keypair } from "@stellar/stellar-sdk"

const BASE_URL = "http://localhost:3000"

async function main() {
  console.log("Generating test keypair...")
  const keypair = Keypair.random()
  const pubkey = keypair.publicKey()
  console.log("Test pubkey:", pubkey)

  console.log("\nRequesting challenge...")
  const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey }),
  })

  if (!challengeRes.ok) {
    console.error("Challenge request failed:", await challengeRes.text())
    return
  }

  const { challenge } = await challengeRes.json()
  console.log("Got challenge:", challenge)

  console.log("\nSigning challenge with private key...")
  const challengeBuffer = Buffer.from(challenge, "utf8")
  const signatureBuffer = keypair.sign(challengeBuffer)
  const signature = signatureBuffer.toString("base64")
  console.log("Signature (base64):", signature)

  console.log("\nSending to /api/auth/verify...")
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature }),
  })

  const verifyData = await verifyRes.json()

  if (verifyRes.ok) {
    console.log("\n✅ SUCCESS — got a JWT back:")
    console.log(verifyData.token)
  } else {
    console.log("\n❌ FAILED:")
    console.log(verifyData)
  }
}

main().catch(console.error)