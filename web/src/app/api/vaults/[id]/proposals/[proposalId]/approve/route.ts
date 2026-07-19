import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId, proposalId } = await params

    const proposal = await prisma.vaultProposal.findUnique({ where: { id: proposalId } })
    if (!proposal || proposal.vaultId !== vaultId) {
      return Response.json({ error: "Proposal not found" }, { status: 404 })
    }
    if (proposal.status !== "pending") {
      return Response.json({ error: "Proposal is no longer pending" }, { status: 409 })
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey === auth.pubkey) {
      return Response.json(
        { error: "The owner proposed this change; approval is implicit" },
        { status: 400 }
      )
    }

    const isMember = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } },
    })
    if (!isMember) {
      return Response.json({ error: "Not a member of this vault" }, { status: 403 })
    }

    await prisma.vaultProposalApproval.upsert({
      where: { proposalId_pubkey: { proposalId, pubkey: auth.pubkey } },
      create: { proposalId, pubkey: auth.pubkey },
      update: {},
    })

    const [allMembers, approvals] = await Promise.all([
      prisma.vaultMember.findMany({ where: { vaultId, role: { not: "Owner" } } }),
      prisma.vaultProposalApproval.findMany({ where: { proposalId } }),
    ])

    const approvedPubkeys = new Set(approvals.map((a) => a.pubkey))
    const unanimous = allMembers.every((m) => approvedPubkeys.has(m.pubkey))

    await logActivity({
      pubkey: auth.pubkey,
      action: "proposal_approved",
      vaultId,
      detail: `Approved ${proposal.type} proposal on "${vault.name}"`,
    })

    if (!unanimous) {
      return Response.json({
        status: "pending",
        approvedCount: approvals.length,
        requiredCount: allMembers.length,
      })
    }

    const updated = await prisma.vaultProposal.update({
      where: { id: proposalId },
      data: { status: "approved" },
    })

    return Response.json({ status: "approved", proposal: updated })
  } catch (error) {
    console.error("Proposal approval error:", error)
    return Response.json({ error: "Failed to approve proposal" }, { status: 500 })
  }
}