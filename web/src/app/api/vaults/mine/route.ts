import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function GET(request: Request) {
  const auth = verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const owned = await prisma.vault.findMany({
      where: { ownerPubkey: auth.pubkey },
      orderBy: { createdAt: "desc" },
    })

    const memberships = await prisma.vaultMember.findMany({
      where: { pubkey: auth.pubkey },
      include: { vault: true },
      orderBy: { addedAt: "desc" },
    })

    // Exclude vaults the user owns from "joined" — they're already in `owned`,
    // since the creator is always auto-added as a VaultMember too.
    const joined = memberships
      .map((m) => m.vault)
      .filter((v) => v.ownerPubkey !== auth.pubkey)

    const serialize = (v: (typeof owned)[number]) => ({
      ...v,
      onChainVaultId: v.onChainVaultId.toString(), // BigInt isn't valid JSON
    })

    return Response.json({
      owned: owned.map(serialize),
      joined: joined.map(serialize),
    })
  } catch (error) {
    console.error("Failed to fetch vaults:", error)
    return Response.json({ error: "Failed to fetch vaults" }, { status: 500 })
  }
}