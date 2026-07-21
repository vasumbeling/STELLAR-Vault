import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { createNotification, notifyVaultMembers } from "@/lib/notificationHelpers"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; pubkey: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId, pubkey: targetPubkey } = await params

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json({ error: "Only the vault owner can remove members" }, { status: 403 })
    }

    if (targetPubkey === vault.ownerPubkey) {
      return Response.json({ error: "The vault owner cannot be removed" }, { status: 400 })
    }

    const membership = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: targetPubkey } },
    })

    if (!membership) {
      return Response.json({ error: "This member is not part of the vault" }, { status: 404 })
    }

    await prisma.vaultMember.delete({
      where: { vaultId_pubkey: { vaultId, pubkey: targetPubkey } },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "member_removed",
      vaultId,
      detail: `Removed ${targetPubkey} from "${vault.name}"`,
    })

    const timestamp = new Date().toISOString()

    await createNotification({
      pubkey: targetPubkey,
      vaultId,
      message: `You were removed from collaborative vault "${vault.name}".`,
      variant: "warning",
      meta: {
        event: "member_removed",
        vaultName: vault.name,
        timestamp,
      },
    })

    await createNotification({
      pubkey: auth.pubkey,
      vaultId,
      message: `Member ${targetPubkey} was removed from collaborative vault "${vault.name}".`,
      variant: "info",
      meta: {
        event: "member_removed",
        memberPubkey: targetPubkey,
        vaultName: vault.name,
        timestamp,
      },
    })

    await notifyVaultMembers({
      vaultId,
      excludePubkeys: [targetPubkey],
      message: `A member was removed from collaborative vault "${vault.name}".`,
      variant: "warning",
      meta: {
        event: "member_removed",
        memberPubkey: targetPubkey,
        vaultName: vault.name,
        timestamp,
      },
    })

    return Response.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Member removal error:", error)
    return Response.json({ error: "Failed to remove member" }, { status: 500 })
  }
}
