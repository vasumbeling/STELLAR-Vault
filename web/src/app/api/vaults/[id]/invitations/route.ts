import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = verifyAuth(request)

    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId } = await params
    const body = await request.json()
    const { inviteePubkey } = body

    if (!inviteePubkey) {
      return Response.json({ error: "inviteePubkey is required" }, { status: 400 })
    }

    const vault = await prisma.vault.findUnique({
      where: { id: vaultId }
    })

    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the vault owner can send invitations" },
        { status: 403 }
      )
    }

    const invitation = await prisma.invitation.create({
      data: {
        vaultId: vault.id,
        invitedBy: auth.pubkey,
        inviteePubkey,
      }
    })

    await prisma.notification.create({
      data: {
        pubkey: inviteePubkey,
        message: `You've been invited to join the vault "${vault.name}"`,
      }
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "invitation_sent",
      vaultId: vault.id,
      detail: `Invited ${inviteePubkey} to "${vault.name}"`,
    })

    return Response.json(invitation, { status: 201 })
  } catch (error) {
    console.error("Invitation creation error:", error)
    return Response.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    )
  }
}