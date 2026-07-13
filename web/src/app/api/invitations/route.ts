import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invitations = await prisma.invitation.findMany({
      where: { inviteePubkey: auth.pubkey, status: "pending" },
      include: { vault: true },
      orderBy: { createdAt: "desc" },
    })

    const serialized = invitations.map((inv) => ({
      ...inv,
      vault: inv.vault
        ? { ...inv.vault, onChainVaultId: inv.vault.onChainVaultId.toString() }
        : null,
    }))

    return Response.json(serialized)
  } catch (error) {
    console.error("Invitation list error:", error)
    return Response.json({ error: "Failed to load invitations" }, { status: 500 })
  }
}
