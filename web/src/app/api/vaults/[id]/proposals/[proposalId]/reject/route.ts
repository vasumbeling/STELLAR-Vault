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
        { error: "The owner proposed this change and cannot reject it — withdraw it instead" },
        { status: 400 }
      )
    }

    const isMember = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } },
    })
    if (!isMember) {
      return Response.json({ error: "Not a member of this vault" }, { status: 403 })
    }

    const updated = await prisma.vaultProposal.update({
      where: { id: proposalId },
      data: { status: "rejected" },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "proposal_rejected",
      vaultId,
      detail: `Rejected ${proposal.type} proposal on "${vault.name}"`,
    })

    return Response.json({ status: "rejected", proposal: updated })
  } catch (error) {
    console.error("Proposal rejection error:", error)
    return Response.json({ error: "Failed to reject proposal" }, { status: 500 })
  }
}