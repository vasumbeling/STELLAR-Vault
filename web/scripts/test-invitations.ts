import { Keypair } from "@stellar/stellar-sdk"

const BASE_URL = "http://localhost:3000"

async function login(keypair: Keypair) {
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

  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey, signature }),
  })
  const { token } = await verifyRes.json()
  return token
}

async function main() {
  console.log("=== Setting up test users ===")
  const owner = Keypair.random()
  const invitee = Keypair.random()
  const stranger = Keypair.random()

  console.log("Owner pubkey:", owner.publicKey())
  console.log("Invitee pubkey:", invitee.publicKey())
  console.log("Stranger pubkey:", stranger.publicKey())

  console.log("\n=== Logging in owner ===")
  const ownerToken = await login(owner)
  console.log("Owner JWT acquired")

console.log("\n=== Creating a test vault as owner ===")
  const vaultRes = await fetch(`${BASE_URL}/api/vaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Vault for Invitations",
      description: "Created by test-invitations.ts",
      goalType: "savings",
      targetAmount: 100,
      contractId: `test-contract-${Date.now()}`,
      ownerPubkey: owner.publicKey(),
    }),
  })
  const vault = await vaultRes.json()
  console.log("Vault created:", vault.id)
  
  console.log("\n=== Owner invites invitee (should succeed) ===")
  const inviteRes = await fetch(`${BASE_URL}/api/vaults/${vault.id}/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ inviteePubkey: invitee.publicKey() }),
  })
  console.log("Status:", inviteRes.status)
  console.log(await inviteRes.json())

  console.log("\n=== Stranger tries to invite someone to owner's vault (should fail 403) ===")
  const strangerToken = await login(stranger)
  const badInviteRes = await fetch(`${BASE_URL}/api/vaults/${vault.id}/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${strangerToken}`,
    },
    body: JSON.stringify({ inviteePubkey: "GSOMEOTHERPUBKEY" }),
  })
  console.log("Status:", badInviteRes.status)
  console.log(await badInviteRes.json())

  console.log("\n=== Invitee logs in and checks their notifications ===")
  const inviteeToken = await login(invitee)
  const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
    headers: { Authorization: `Bearer ${inviteeToken}` },
  })
  console.log("Status:", notifRes.status)
  console.log(await notifRes.json())

  console.log("\n=== Sanity check: request with no token (should fail 401) ===")
  const noAuthRes = await fetch(`${BASE_URL}/api/notifications`)
  console.log("Status:", noAuthRes.status)
  console.log(await noAuthRes.json())
}



main().catch(console.error)