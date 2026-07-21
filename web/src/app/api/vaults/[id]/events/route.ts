import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { createNotification, notifyVaultMembers } from "@/lib/notificationHelpers"

const VALID_EVENT_TYPES = [
  "deposit",
  "withdraw",
  "withdrawal_requested",
  "withdrawal_approved",
  "withdrawal_executed",
  "vault_closed",
  "distribution_completed",
  "distribution_failed",
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
    case "distribution_completed":
      return handleDistributionCompleted(vault, body, reporterPubkey)
    case "distribution_failed":
      return handleDistributionFailed(vault, body, reporterPubkey)
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

  const progress = Math.min(100, Number(((newBalance / vault.targetAmount) * 100).toFixed(2)))
  const timestamp = new Date().toISOString()
  const formattedAmount = Number(amount).toFixed(7)
  const formattedBalance = Number(newBalance).toFixed(2)
  const formattedProgress = `${progress.toFixed(0)}%`

  await createNotification({
    pubkey: reporterPubkey,
    vaultId: vault.id,
    message: `You deposited ${formattedAmount} USDC into "${vault.name}". Balance: ${formattedBalance} USDC (${formattedProgress} of goal).`,
    variant: "success",
    meta: {
      event: "deposit",
      amount: formattedAmount,
      vaultName: vault.name,
      currentBalance: newBalance,
      progress,
      timestamp,
    },
  })

  await notifyVaultMembers({
    vaultId: vault.id,
    excludePubkeys: [reporterPubkey],
    message: `${reporterPubkey} deposited ${formattedAmount} USDC into "${vault.name}". Balance: ${formattedBalance} USDC (${formattedProgress} of goal).`,
    variant: "info",
    meta: {
      event: "deposit",
      amount: formattedAmount,
      vaultName: vault.name,
      currentBalance: newBalance,
      progress,
      timestamp,
    },
  })

  if (newStatus === "GoalReached") {
    await notifyVaultMembers({
      vaultId: vault.id,
      message: `Collaborative vault "${vault.name}" has reached 100% of its savings goal and is ready for distribution.`,
      variant: "success",
      meta: {
        event: "goal_reached",
        vaultName: vault.name,
        currentBalance: newBalance,
        targetAmount: vault.targetAmount,
        progress: 100,
        timestamp,
      },
    })
  }

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

  const timestamp = new Date().toISOString()

  await logActivity({
    pubkey: reporterPubkey,
    action: "vault_closed",
    vaultId: vault.id,
    detail: `Closed vault "${vault.name}"`,
  })

  await createNotification({
    pubkey: reporterPubkey,
    vaultId: vault.id,
    message: `Collaborative vault "${vault.name}" has been closed.`,
    variant: "info",
    meta: {
      event: "vault_closed",
      vaultName: vault.name,
      timestamp,
    },
  })

  await notifyVaultMembers({
    vaultId: vault.id,
    excludePubkeys: [reporterPubkey],
    message: `Collaborative vault "${vault.name}" has been closed.`,
    variant: "info",
    meta: {
      event: "vault_closed",
      vaultName: vault.name,
      timestamp,
    },
  })

  return {
    data: {
      ...updated,
      onChainVaultId: updated.onChainVaultId.toString(),
    }
  }
}

async function handleDistributionCompleted(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const totalAmount = Number(body.totalAmount ?? vault.balance)
  const memberCount = Number(body.memberCount ?? (await prisma.vaultMember.count({ where: { vaultId: vault.id } })))
  const shareAmount = Number(body.shareAmount ?? (memberCount > 0 ? totalAmount / memberCount : 0))

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { error: "totalAmount must be a positive number", status: 400 }
  }
  if (!Number.isFinite(memberCount) || memberCount <= 0) {
    return { error: "memberCount must be a positive number", status: 400 }
  }
  if (!Number.isFinite(shareAmount) || shareAmount <= 0) {
    return { error: "shareAmount must be a positive number", status: 400 }
  }

  const timestamp = new Date().toISOString()
  const formattedTotal = Number(totalAmount).toFixed(2)
  const formattedShare = Number(shareAmount).toFixed(2)

  await logActivity({
    pubkey: reporterPubkey,
    action: "distribution_completed",
    vaultId: vault.id,
    detail: `Distributed ${formattedTotal} USDC across ${memberCount} members in "${vault.name}"`,
  })

  await createNotification({
    pubkey: reporterPubkey,
    vaultId: vault.id,
    message: `Distribution completed successfully. Total distributed: ${formattedTotal} USDC, your share: ${formattedShare} USDC, members: ${memberCount}.`,
    variant: "success",
    meta: {
      event: "distribution_completed",
      totalAmount: Number(totalAmount).toFixed(2),
      shareAmount: Number(shareAmount).toFixed(2),
      memberCount,
      timestamp,
    },
  })

  await notifyVaultMembers({
    vaultId: vault.id,
    excludePubkeys: [reporterPubkey],
    message: `Distribution completed successfully. Total distributed: ${formattedTotal} USDC, your share: ${formattedShare} USDC, members: ${memberCount}.`,
    variant: "success",
    meta: {
      event: "distribution_completed",
      totalAmount: Number(totalAmount).toFixed(2),
      shareAmount: Number(shareAmount).toFixed(2),
      memberCount,
      timestamp,
    },
  })

  return { data: { status: "distributed", totalAmount, shareAmount, memberCount, timestamp } }
}

async function handleDistributionFailed(vault: Vault, body: Record<string, unknown>, reporterPubkey: string) {
  const errorMessage = String(body.error ?? body.message ?? "Distribution failed due to an unexpected error.")
  const timestamp = new Date().toISOString()

  await logActivity({
    pubkey: reporterPubkey,
    action: "distribution_failed",
    vaultId: vault.id,
    detail: `Distribution failed for "${vault.name}": ${errorMessage}`,
  })

  await createNotification({
    pubkey: reporterPubkey,
    vaultId: vault.id,
    message: `Distribution failed: ${errorMessage}`,
    variant: "error",
    meta: {
      event: "distribution_failed",
      error: errorMessage,
      timestamp,
    },
  })

  await notifyVaultMembers({
    vaultId: vault.id,
    excludePubkeys: [reporterPubkey],
    message: `Distribution failed: ${errorMessage}`,
    variant: "error",
    meta: {
      event: "distribution_failed",
      error: errorMessage,
      timestamp,
    },
  })

  return { data: { status: "distribution_failed", error: errorMessage, timestamp } }
}
