import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"

export async function GET() {
  const vaults = await prisma.vault.findMany({
    orderBy: { createdAt: "desc" }
  })
  return Response.json(vaults)
}

export async function POST(request: Request) {
  try {
    const auth = verifyAuth(request)

    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const ownerPubkey = auth.pubkey

    await prisma.user.upsert({
      where: { pubkey: ownerPubkey },
      update: {},
      create: { pubkey: ownerPubkey },
    })

    const vault = await prisma.vault.create({
      data: {
        name: body.name,
        description: body.description,
        goalType: body.goalType,
        targetAmount: body.targetAmount,
        contractId: body.contractId,
        ownerPubkey,
      }
    })

    await logActivity({
      pubkey: ownerPubkey,
      action: "vault_created",
      vaultId: vault.id,
      detail: `Created vault "${vault.name}"`,
    })

    return Response.json(vault, { status: 201 })
  } catch (error) {
    console.error("Vault creation error:", error)
    return Response.json(
      { error: "Failed to create vault" },
      { status: 500 }
    )
  }
}