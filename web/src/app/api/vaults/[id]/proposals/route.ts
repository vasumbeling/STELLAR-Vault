import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

const VALID_TYPES = ["edit_goal", "edit_lock", "delete"] as const
type ProposalType = (typeof VALID_TYPES)[number]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId } = await params

    const isMember = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } },
    })
    if (!isMember) {
      return Response.json({ error: "Not a member of this vault" }, { status: 403 })
    }

    const proposals = await prisma.vaultProposal.findMany({
      where: { vaultId },
      include: { approvals: true },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(proposals)
  } catch (error) {
    console.error("Vault proposals fetch error:", error)
    return Response.json({ error: "Failed to fetch proposals" }, { status: 500 })
  }
}

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
    const { type, changes } = body as { type: ProposalType; changes?: Record<string, unknown> }

    if (!type || !VALID_TYPES.includes(type)) {
      return Response.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.vaultType !== "Collaborative") {
      return Response.json(
        { error: "Only Collaborative vaults use the proposal system" },
        { status: 400 }
      )
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json({ error: "Only the vault owner can propose changes" }, { status: 403 })
    }

    if (vault.status === "Closed") {
      return Response.json({ error: "Vault is already closed" }, { status: 409 })
    }

    const existingPending = await prisma.vaultProposal.findFirst({
      where: { vaultId, status: "pending" },
    })
    if (existingPending) {
      return Response.json(
        { error: "This vault already has a pending proposal. Resolve it before creating another." },
        { status: 409 }
      )
    }

    if (type === "edit_goal") {
      const targetAmount = Number((changes ?? {}).targetAmount)
      if (!targetAmount || targetAmount <= 0) {
        return Response.json({ error: "changes.targetAmount must be a positive number" }, { status: 400 })
      }
    }

    if (type === "edit_lock") {
      const lockUntil = (changes ?? {}).lockUntil
      if (!lockUntil) {
        return Response.json({ error: "changes.lockUntil is required" }, { status: 400 })
      }
    }

    if (type === "delete" && vault.balance !== 0) {
      return Response.json(
        { error: "Distribute all funds before proposing to delete this vault" },
        { status: 409 }
      )
    }

    const nonOwnerMembers = await prisma.vaultMember.count({
      where: { vaultId, role: { not: "Owner" } },
    })

    const proposal = await prisma.vaultProposal.create({
      data: {
        vaultId,
        proposedBy: auth.pubkey,
        type,
        changes: type === "delete" ? Prisma.JsonNull : (changes as Prisma.InputJsonValue),
        status: nonOwnerMembers === 0 ? "approved" : "pending",
      },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "proposal_created",
      vaultId,
      detail: `Proposed ${type} on "${vault.name}"`,
    })

    return Response.json(proposal, { status: 201 })
  } catch (error) {
    console.error("Vault proposal creation error:", error)
    return Response.json({ error: "Failed to create proposal" }, { status: 500 })
  }
}