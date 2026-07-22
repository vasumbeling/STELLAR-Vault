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

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the vault owner can execute an approved proposal" },
        { status: 403 }
      )
    }

    const proposal = await prisma.vaultProposal.findUnique({ where: { id: proposalId } })
    if (!proposal || proposal.vaultId !== vaultId) {
      return Response.json({ error: "Proposal not found" }, { status: 404 })
    }

    if (proposal.status !== "approved") {
      return Response.json({ error: "Proposal is not approved yet" }, { status: 409 })
    }

    if (proposal.type === "delete") {
      if (vault.balance !== 0) {
        return Response.json(
          { error: "Distribute all funds before executing a delete proposal" },
          { status: 409 }
        )
      }
      // Client must submit a signed close_vault XDR and confirm it on-chain
      // before calling this route — this only syncs the DB afterward.
      await prisma.vault.update({
        where: { id: vaultId },
        data: { status: "Closed" },
      })
    } else {
      // edit_goal / edit_lock — client must have already submitted the signed
      // update_goal / update_lock XDR and it must have confirmed on-chain
      // before this call. This route only syncs the DB to match.
      const changes = (proposal.changes ?? {}) as Record<string, unknown>
      const data: Record<string, unknown> = { ...changes }
      if (typeof data.lockUntil === "string") {
        data.lockUntil = new Date(data.lockUntil)
      }
      await prisma.vault.update({
        where: { id: vaultId },
        data,
      })
    }

    const updatedProposal = await prisma.vaultProposal.update({
      where: { id: proposalId },
      data: { status: "executed" },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: `proposal_executed_${proposal.type}`,
      vaultId,
      detail: `Executed ${proposal.type} proposal on "${vault.name}"`,
    })

    return Response.json({ success: true, proposal: updatedProposal })
  } catch (error) {
    console.error("Proposal execution error:", error)
    return Response.json({ error: "Failed to execute proposal" }, { status: 500 })
  }
}