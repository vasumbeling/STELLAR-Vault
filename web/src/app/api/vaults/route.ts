import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { createNotification } from "@/lib/notificationHelpers"
import { Prisma } from "@prisma/client"

function serializeVault(vault: { onChainVaultId: bigint; [key: string]: unknown }) {
  return { ...vault, onChainVaultId: vault.onChainVaultId.toString() }
}

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)

    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const vaults = await prisma.vault.findMany({
      where: { ownerPubkey: auth.pubkey },
      orderBy: { createdAt: "desc" }
    })

    return Response.json(vaults.map(serializeVault))
  } catch (error) {
    console.error("Vault fetch error:", error)
    return Response.json(
      { error: "Failed to fetch vaults" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyAuth(request)

    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const ownerPubkey = auth.pubkey

    const {
      name,
      description,
      goalType,
      targetAmount,
      contractAddress,
      onChainVaultId,
      vaultType,
      lockUntil,
    } = body

    if (!name || !goalType || !targetAmount || !contractAddress || onChainVaultId === undefined || !vaultType) {
      return Response.json(
        {
          error:
            "Missing required fields: name, goalType, targetAmount, contractAddress, onChainVaultId, vaultType",
        },
        { status: 400 }
      )
    }

    if (vaultType !== "Personal" && vaultType !== "Collaborative") {
      return Response.json(
        { error: "vaultType must be 'Personal' or 'Collaborative'" },
        { status: 400 }
      )
    }

    let parsedOnChainVaultId: bigint
    try {
      parsedOnChainVaultId = BigInt(onChainVaultId)
    } catch {
      return Response.json(
        { error: "onChainVaultId must be a valid integer" },
        { status: 400 }
      )
    }

    const owner = await prisma.user.findUnique({ where: { pubkey: ownerPubkey } })
    if (!owner) {
      return Response.json(
        { error: "Owner has no registered user account yet" },
        { status: 404 }
      )
    }

    const vault = await prisma.vault.create({
      data: {
        name,
        description,
        goalType,
        targetAmount,
        contractAddress,
        onChainVaultId: parsedOnChainVaultId,
        vaultType,
        lockUntil: lockUntil ? new Date(lockUntil) : null,
        ownerPubkey,
      }
    })

    await logActivity({
      pubkey: ownerPubkey,
      action: "vault_created",
      vaultId: vault.id,
      detail: `Created vault "${vault.name}"`,
    })
    
    await prisma.vaultMember.create({
      data: {
        vaultId: vault.id,
        pubkey: ownerPubkey,
        role: "Owner",
      }
    })

    await createNotification({
      pubkey: ownerPubkey,
      vaultId: vault.id,
      message: `${vault.vaultType === 'Collaborative' ? 'Collaborative' : 'Personal'} vault "${vault.name}" created successfully.`,
      variant: "success",
      meta: {
        event: "vault_created",
        vaultName: vault.name,
        targetAmount: vault.targetAmount,
      },
    })

    return Response.json(serializeVault(vault), { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json(
        { error: "A vault with this contractAddress and onChainVaultId already exists" },
        { status: 409 }
      )
    }

    console.error("Vault creation error:", error)
    return Response.json(
      { error: "Failed to create vault" },
      { status: 500 }
    )
  }
}
