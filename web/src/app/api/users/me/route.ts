import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { loadProfile, loadTrustScore } from "@/lib/auth/verification"

export async function GET(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile, trust] = await Promise.all([
    loadProfile(auth.pubkey),
    loadTrustScore(auth.pubkey),
  ])

  if (!profile) {
    return Response.json({ error: "Account not found" }, { status: 404 })
  }

  const [user, vaultsCount] = await Promise.all([
    prisma.user.findUnique({ where: { pubkey: auth.pubkey }, select: { points: true } }),
    prisma.vaultMember.count({ where: { pubkey: auth.pubkey } }),
  ])

  return Response.json({ profile, trust, points: user?.points ?? 0, vaultsCount })
}

export async function DELETE(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({ where: { pubkey: auth.pubkey } })

    if (!user || user.deletedAt) {
      return Response.json({ error: "Account no longer active" }, { status: 401 })
    }

    const ownedVaultWithBalance = await prisma.vault.findFirst({
      where: {
        ownerPubkey: auth.pubkey,
        balance: { gt: 0 },
      },
      select: { id: true, name: true },
    })

    if (ownedVaultWithBalance) {
      return Response.json(
        {
          error: `Withdraw or distribute the funds in "${ownedVaultWithBalance.name}" before deleting your account.`,
        },
        { status: 409 }
      )
    }

    const pendingTransfer = await prisma.pendingTransfer.findFirst({
      where: {
        OR: [{ senderPubkey: auth.pubkey }, { recipientPubkey: auth.pubkey }],
        status: { not: "submitted" },
      },
      select: { id: true },
    })

    if (pendingTransfer) {
      return Response.json(
        { error: "You have a pending transfer that hasn't completed yet. Please wait for it to finish before deleting your account." },
        { status: 409 }
      )
    }

    await prisma.user.update({
      where: { pubkey: auth.pubkey },
      data: {
        deletedAt: new Date(),
        username: null,
        avatarUrl: null,
      },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Account deletion error:", error)
    return Response.json({ error: "Failed to delete account" }, { status: 500 })
  }
}