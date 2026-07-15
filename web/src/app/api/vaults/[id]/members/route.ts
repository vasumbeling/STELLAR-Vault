import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { Prisma } from "@prisma/client"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)

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

    const isMember = await prisma.vaultMember.findUnique({
      where: { vaultId_pubkey: { vaultId, pubkey: auth.pubkey } }
    })

    if (!isMember) {
      return Response.json(
        { error: "You do not have access to this vault's members" },
        { status: 403 }
      )
    }

    const members = await prisma.vaultMember.findMany({
      where: { vaultId },
      orderBy: { addedAt: "asc" }
    })

    return Response.json(members)
  } catch (error) {
    console.error("Member list error:", error)
    return Response.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    )
  }
}

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
    const body = await request.json()
    const { pubkey } = body

    if (!pubkey) {
      return Response.json({ error: "pubkey is required" }, { status: 400 })
    }

    const vault = await prisma.vault.findUnique({
      where: { id: vaultId }
    })

    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.vaultType !== "Collaborative") {
      return Response.json(
        { error: "Only Collaborative vaults can have members added" },
        { status: 400 }
      )
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the vault owner can confirm new members" },
        { status: 403 }
      )
    }

    const memberUser = await prisma.user.findUnique({ where: { pubkey } })
    if (!memberUser || memberUser.deletedAt) {
      return Response.json({ error: "This pubkey has no active user account" }, { status: 404 })
    }

    const member = await prisma.vaultMember.create({
      data: {
        vaultId,
        pubkey,
        role: "Contributor",
      }
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "member_added",
      vaultId,
      detail: `${pubkey} confirmed as a member of "${vault.name}"`,
    })

    return Response.json(member, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "This pubkey is already a member of this vault" },
        { status: 409 }
      )
    }

    console.error("Member add error:", error)
    return Response.json(
      { error: "Failed to add member" },
      { status: 500 }
    )
  }
}
