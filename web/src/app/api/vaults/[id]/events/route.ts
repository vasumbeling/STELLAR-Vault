import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

const VALID_EVENT_TYPES = [
  "deposit",
  "withdraw",
  "withdrawal_requested",
  "withdrawal_approved",
  "withdrawal_executed",
  "vault_closed",
] as const

type EventType = (typeof VALID_EVENT_TYPES)[number]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId } = await params
    const body = await request.json()
    const { eventType } = body

    if (!eventType || !VALID_EVENT_TYPES.includes(eventType)) {
      return Response.json(
        { error: `eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    // Only a recognized member (owner or contributor) can report events for a vault
    const isMember = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } }
    })
    if (!isMember) {
      return Response.json(
        { error: "You do not have access to report events for this vault" },
        { status: 403 }
      )
    }

    if (vault.status === "Closed") {
      return Response.json(
        { error: "This vault is closed, no further events can be recorded" },
        { status: 400 }
      )
    }

    const result = await handleEvent(eventType, vault, body, auth.pubkey)
    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status })
    }

    return Response.json(result.data, { status: 200 })
  } catch (error) {
    console.error("Vault event error:", error)
    return Response.json(
      { error: "Failed to record vault event" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------

type Vault = {
  id: string
  name: string
  balance: number
  targetAmount: number
  status: string
}

async function handleEvent(
  eventType: EventType,
  vault: Vault,
  body: Record<string, unknown>,
  reporterPubkey: string
): Promise<{ data: unknown } | { error: string; status: number }> {
  switch (eventType) {
    case "deposit":
      return handleDeposit(vault, body, reporterPubkey)
    case "withdraw":
      return handleWithdraw(vault, body, reporterPubkey)
    case "withdrawal_requested":
      return handleWithdrawalRequested(vault, body, reporterPubkey)
    case "withdrawal_approved":
      return handleWithdrawalApproved(vault, body, reporterPubkey)
    case "withdrawal_executed":
      return handleWithdrawalExecuted(vault, body, reporterPubkey)
    case "vault_closed":
      return handleVaultClosed(vault, reporterPubkey)
  }
}

async function handleDeposit(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const amount = Number(body.amount)
  if (!amount || amount <= 0) {
    return { error: "amount must be a positive number", status: 400 }
  }

  const newBalance = vault.balance + amount
  const newStatus = newBalance >= vault.targetAmount ? "GoalReached" : "Active"

  const updated = await prisma.vault.update({
    where: { id: vault.id },
    data: { balance: newBalance, status: newStatus },
  })

  await logActivity({
    pubkey: reporterPubkey,
    action: "deposit",
    vaultId: vault.id,
    detail: `Deposited ${amount} into "${vault.name}" (new balance: ${newBalance})`,
  })

  return {
    data: {
        ...updated,
        balance: newBalance,
        onChainVaultId: updated.onChainVaultId.toString(),
    }
    }
}

async function handleWithdraw(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const amount = Number(body.amount)
  const recipient = body.recipient

  if (!amount || amount <= 0) {
    return { error: "amount must be a positive number", status: 400 }
  }
  if (!recipient) {
    return { error: "recipient is required", status: 400 }
  }
  if (amount > vault.balance) {
    return { error: "amount exceeds vault balance", status: 400 }
  }

  const newBalance = vault.balance - amount

  const updated = await prisma.vault.update({
    where: { id: vault.id },
    data: { balance: newBalance },
  })

  await logActivity({
    pubkey: reporterPubkey,
    action: "withdraw",
    vaultId: vault.id,
    detail: `Withdrew ${amount} from "${vault.name}" to ${recipient} (new balance: ${newBalance})`,
  })

  return {
    data: {
        ...updated,
        balance: newBalance,
        onChainVaultId: updated.onChainVaultId.toString(),
    }
    }
}

async function handleWithdrawalRequested(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const amount = Number(body.amount)
  const recipient = body.recipient
  const requestId = body.requestId

  if (!amount || amount <= 0) {
    return { error: "amount must be a positive number", status: 400 }
  }
  if (!recipient || requestId === undefined) {
    return { error: "recipient and requestId are required", status: 400 }
  }

  await logActivity({
    pubkey: reporterPubkey,
    action: "withdrawal_requested",
    vaultId: vault.id,
    detail: `Requested withdrawal #${requestId} of ${amount} from "${vault.name}" to ${recipient}`,
  })

  return { data: { status: "logged" } }
}

async function handleWithdrawalApproved(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const requestId = body.requestId
  if (requestId === undefined) {
    return { error: "requestId is required", status: 400 }
  }

  await logActivity({
    pubkey: reporterPubkey,
    action: "withdrawal_approved",
    vaultId: vault.id,
    detail: `Approved withdrawal #${requestId} for "${vault.name}"`,
  })

  return { data: { status: "logged" } }
}

async function handleWithdrawalExecuted(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const amount = Number(body.amount)
  const recipient = body.recipient
  const requestId = body.requestId

  if (!amount || amount <= 0) {
    return { error: "amount must be a positive number", status: 400 }
  }
  if (!recipient || requestId === undefined) {
    return { error: "recipient and requestId are required", status: 400 }
  }
  if (amount > vault.balance) {
    return { error: "amount exceeds vault balance", status: 400 }
  }

  const newBalance = vault.balance - amount

  const updated = await prisma.vault.update({
    where: { id: vault.id },
    data: { balance: newBalance },
  })

  await logActivity({
    pubkey: reporterPubkey,
    action: "withdrawal_executed",
    vaultId: vault.id,
    detail: `Executed withdrawal #${requestId} of ${amount} from "${vault.name}" to ${recipient} (new balance: ${newBalance})`,
  })

  return {
    data: {
        ...updated,
        balance: newBalance,
        onChainVaultId: updated.onChainVaultId.toString(),
    }
    }
}

async function handleVaultClosed(vault: Vault, reporterPubkey: string) {
  if (vault.balance !== 0) {
    return { error: "Vault balance must be 0 before it can be closed", status: 400 }
  }

  const updated = await prisma.vault.update({
    where: { id: vault.id },
    data: { status: "Closed" },
  })

  await logActivity({
    pubkey: reporterPubkey,
    action: "vault_closed",
    vaultId: vault.id,
    detail: `Closed vault "${vault.name}"`,
  })

  return {
    data: {
      ...updated,
      onChainVaultId: updated.onChainVaultId.toString(),
    }
  }
}
