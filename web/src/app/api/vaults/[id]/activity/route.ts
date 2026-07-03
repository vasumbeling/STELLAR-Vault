import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: vaultId } = await params

  const vault = await prisma.vault.findUnique({
    where: { id: vaultId }
  })

  if (!vault) {
    return Response.json({ error: "Vault not found" }, { status: 404 })
  }

  const isOwner = vault.ownerPubkey === auth.pubkey

  const hasInvitation = await prisma.invitation.findFirst({
    where: {
      vaultId: vault.id,
      inviteePubkey: auth.pubkey,
    }
  })

  if (!isOwner && !hasInvitation) {
    return Response.json(
      { error: "You do not have access to this vault's activity" },
      { status: 403 }
    )
  }

  const activity = await prisma.activityLog.findMany({
    where: { vaultId: vault.id },
    orderBy: { createdAt: "desc" }
  })

  return Response.json(activity)
}