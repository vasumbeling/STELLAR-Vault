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

  console.log("\n=== Sanity check: create vault with no token (should fail 401) ===")
  const noAuthVaultRes = await fetch(`${BASE_URL}/api/vaults`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Should Not Be Created",
      goalType: "savings",
      targetAmount: 100,
      contractId: `test-contract-noauth-${Date.now()}`,
      ownerPubkey: owner.publicKey(),
    }),
  })
  console.log("Status:", noAuthVaultRes.status)
  console.log(await noAuthVaultRes.json())

  console.log("\n=== Creating a test vault as owner (with token) ===")
  const vaultRes = await fetch(`${BASE_URL}/api/vaults`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({
      name: "Test Vault for Invitation Response",
      description: "Created by test-invitation-response.ts",
      goalType: "savings",
      targetAmount: 100,
      contractId: `test-contract-${Date.now()}`,
    }),
  })
  const vault = await vaultRes.json()
  console.log("Status:", vaultRes.status)
  console.log("Vault created:", vault.id, "| owner:", vault.ownerPubkey)

  console.log("\n=== Owner invites invitee ===")
  const inviteRes = await fetch(`${BASE_URL}/api/vaults/${vault.id}/invitations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ownerToken}`,
    },
    body: JSON.stringify({ inviteePubkey: invitee.publicKey() }),
  })
  const invitation = await inviteRes.json()
  console.log("Status:", inviteRes.status)
  console.log(invitation)

  console.log("\n=== Invitee and stranger log in ===")
  const inviteeToken = await login(invitee)
  const strangerToken = await login(stranger)

  console.log("\n=== Stranger tries to respond to invitation (should fail 403) ===")
  const strangerRes = await fetch(`${BASE_URL}/api/invitations/${invitation.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${strangerToken}`,
    },
    body: JSON.stringify({ status: "accepted" }),
  })
  console.log("Status:", strangerRes.status)
  console.log(await strangerRes.json())

  console.log("\n=== No token (should fail 401) ===")
  const noAuthRes = await fetch(`${BASE_URL}/api/invitations/${invitation.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "accepted" }),
  })
  console.log("Status:", noAuthRes.status)
  console.log(await noAuthRes.json())

  console.log("\n=== Invitee sends an invalid status value (should fail 400) ===")
  const badStatusRes = await fetch(`${BASE_URL}/api/invitations/${invitation.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inviteeToken}`,
    },
    body: JSON.stringify({ status: "maybe" }),
  })
  console.log("Status:", badStatusRes.status)
  console.log(await badStatusRes.json())

  console.log("\n=== Invitee accepts the invitation (should succeed 200) ===")
  const acceptRes = await fetch(`${BASE_URL}/api/invitations/${invitation.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inviteeToken}`,
    },
    body: JSON.stringify({ status: "accepted" }),
  })
  console.log("Status:", acceptRes.status)
  console.log(await acceptRes.json())

  console.log("\n=== Invitee tries to respond again (should fail 400, already accepted) ===")
  const doubleRes = await fetch(`${BASE_URL}/api/invitations/${invitation.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inviteeToken}`,
    },
    body: JSON.stringify({ status: "declined" }),
  })
  console.log("Status:", doubleRes.status)
  console.log(await doubleRes.json())
}

main().catch(console.error)