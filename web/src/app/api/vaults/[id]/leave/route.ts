import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

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

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey === auth.pubkey) {
      return Response.json(
        { error: "Owners cannot leave — delete the vault instead" },
        { status: 400 }
      )
    }

    const membership = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } },
    })
    if (!membership) {
      return Response.json({ error: "You are not a member of this vault" }, { status: 403 })
    }

    // Client must submit a signed remove_member XDR (member's own auth) and
    // confirm it on-chain before calling this route — this only syncs the DB.
    await prisma.vaultMember.delete({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "left_vault",
      vaultId: vault.id,
      detail: `Left "${vault.name}"`,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Vault leave error:", error)
    return Response.json({ error: "Failed to leave vault" }, { status: 500 })
  }
}