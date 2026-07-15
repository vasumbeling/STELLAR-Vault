import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { StrKey } from "@stellar/stellar-sdk"

export async function POST(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const recipientPubkey = String(body?.recipientPubkey ?? "")
    const amount = Number(body?.amount)

    if (!StrKey.isValidEd25519PublicKey(recipientPubkey)) {
      return Response.json({ error: "Please provide a valid Stellar recipient address." }, { status: 400 })
    }
    if (recipientPubkey === auth.pubkey) {
      return Response.json({ error: "You can't send a transfer to yourself." }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: "Please provide a valid positive amount." }, { status: 400 })
    }

    const recipient = await prisma.user.findUnique({ where: { pubkey: recipientPubkey } })
    if (!recipient) {
      return Response.json({ error: "That recipient hasn't registered a STELLA Vault account yet." }, { status: 404 })
    }

    const transfer = await prisma.pendingTransfer.create({
      data: {
        senderPubkey: auth.pubkey,
        recipientPubkey,
        amount,
      },
    })

    return Response.json(transfer)
  } catch (error) {
    console.error("Failed to create pending transfer:", error)
    return Response.json({ error: "Failed to create transfer request" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const transfers = await prisma.pendingTransfer.findMany({
      where: {
        status: { not: "submitted" },
        OR: [{ senderPubkey: auth.pubkey }, { recipientPubkey: auth.pubkey }],
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json({ transfers })
  } catch (error) {
    console.error("Failed to fetch pending transfers:", error)
    return Response.json({ error: "Failed to fetch transfers" }, { status: 500 })
  }
}
