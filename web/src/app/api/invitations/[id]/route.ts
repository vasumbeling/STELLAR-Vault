import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

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
    const body = await request.json()
    const { status } = body
    if (status !== "accepted" && status !== "declined") {
      return Response.json(
        { error: "status must be 'accepted' or 'declined'" },
        { status: 400 }
      )
    }
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: { vault: true }
    })
    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 })
    }
    if (invitation.inviteePubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the invitee can respond to this invitation" },
        { status: 403 }
      )
    }
    if (invitation.status !== "pending") {
      return Response.json(
        { error: `Invitation already ${invitation.status}` },
        { status: 400 }
      )
    }
    const updated = await prisma.invitation.update({
      where: { id: invitationId },
      data: { status }
    })
    await logActivity({
      pubkey: auth.pubkey,
      action: status === "accepted" ? "invitation_accepted" : "invitation_declined",
      vaultId: invitation.vaultId,
      detail: `${auth.pubkey} ${status} the invitation to "${invitation.vault.name}"`,
    })

    if (status === "accepted") {
      await prisma.notification.create({
        data: {
          pubkey: invitation.invitedBy,
          message: `${auth.pubkey} accepted the invitation to join "${invitation.vault.name}".`,
          vaultId: invitation.vaultId,
          variant: "info",
          meta: {
            event: "member_acceptance",
            vaultName: invitation.vault.name,
          },
        },
      })
    }
    return Response.json(updated, { status: 200 })
  } catch (error) {
    console.error("Invitation response error:", error)
    return Response.json(
      { error: "Failed to update invitation" },
      { status: 500 }
    )
  }
}
