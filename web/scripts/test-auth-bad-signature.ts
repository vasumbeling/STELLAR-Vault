import { Keypair } from "@stellar/stellar-sdk"

const BASE_URL = "http://localhost:3000"

async function main() {
  const keypair = Keypair.random()
  const pubkey = keypair.publicKey()
  console.log("Test pubkey:", pubkey)

  console.log("\nRequesting challenge...")
  const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey }),
  })
  const { challenge } = await challengeRes.json()
  console.log("Got challenge:", challenge)

  // Sign a DIFFERENT string than the actual challenge — simulates a tampered/wrong signature
  console.log("\nSigning the WRONG message on purpose...")
  const wrongBuffer = Buffer.from("this is not the challenge", "utf8")
  const signatureBuffer = keypair.sign(wrongBuffer)
  const signature = signatureBuffer.toString("base64")

  console.log("\nSending to /api/auth/verify...")
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature }),
  })

  const verifyData = await verifyRes.json()
  console.log("\nStatus:", verifyRes.status)
  console.log("Response:", verifyData)

  if (verifyRes.status === 401) {
    console.log("\n✅ CORRECT — bad signature was rejected")
  } else {
    console.log("\n❌ PROBLEM — bad signature should have been rejected but wasn't")
  }
}

main().catch(console.error)