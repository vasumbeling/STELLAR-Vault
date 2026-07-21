import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { createNotification, notifyVaultMembers } from "@/lib/notificationHelpers"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: invitationId } = await params
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { vault: true },
    })

    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 })
    }

    if (invitation.vault.ownerPubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the vault owner can confirm membership" },
        { status: 403 }
      )
    }

    if (invitation.status !== "accepted") {
      return Response.json(
        { error: `Invitation must be accepted before confirming (currently ${invitation.status})` },
        { status: 400 }
      )
    }

    const existingMember = await prisma.vaultMember.findFirst({
      where: { vaultId: invitation.vaultId, pubkey: invitation.inviteePubkey },
    })
    if (existingMember) {
      return Response.json({ error: "This address is already a member" }, { status: 409 })
    }

    await prisma.vaultMember.create({
      data: {
        vaultId: invitation.vaultId,
        pubkey: invitation.inviteePubkey,
        role: "Contributor",
      },
    })

    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: "active" },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "member_confirmed",
      vaultId: invitation.vaultId,
      detail: `Confirmed ${invitation.inviteePubkey} as a member of "${invitation.vault.name}" on-chain`,
    })

    const timestamp = new Date().toISOString()

    await createNotification({
      pubkey: invitation.inviteePubkey,
      vaultId: invitation.vaultId,
      message: `You were added as a member of collaborative vault "${invitation.vault.name}".`,
      variant: "success",
      meta: {
        event: "member_added",
        vaultName: invitation.vault.name,
        timestamp,
      },
    })

    await notifyVaultMembers({
      vaultId: invitation.vaultId,
      excludePubkeys: [invitation.inviteePubkey],
      message: `A new member joined collaborative vault "${invitation.vault.name}".`,
      variant: "info",
      meta: {
        event: "member_joined",
        newMemberPubkey: invitation.inviteePubkey,
        vaultName: invitation.vault.name,
        timestamp,
      },
    })

    return Response.json(updated, { status: 200 })
  } catch (error) {
    console.error("Invitation confirm error:", error)
    return Response.json({ error: "Failed to confirm membership" }, { status: 500 })
  }
}
