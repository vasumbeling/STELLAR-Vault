import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const transfer = await prisma.pendingTransfer.findUnique({ where: { id } })
    if (!transfer) {
      return Response.json({ error: "Transfer not found" }, { status: 404 })
    }

    if (auth.pubkey !== transfer.senderPubkey && auth.pubkey !== transfer.recipientPubkey) {
      return Response.json({ error: "You're not part of this transfer." }, { status: 403 })
    }

    const patch: { senderAuthorized?: boolean; receiverAuthorized?: boolean; status?: string } = {}
    if (auth.pubkey === transfer.senderPubkey) {
      patch.senderAuthorized = true
    }
    if (auth.pubkey === transfer.recipientPubkey) {
      patch.receiverAuthorized = true
    }

    const willBeSenderAuthorized = patch.senderAuthorized ?? transfer.senderAuthorized
    const willBeReceiverAuthorized = patch.receiverAuthorized ?? transfer.receiverAuthorized
    if (willBeSenderAuthorized && willBeReceiverAuthorized) {
      patch.status = "ready_to_submit"
    }

    const updated = await prisma.pendingTransfer.update({
      where: { id },
      data: patch,
    })

    return Response.json(updated)
  } catch (error) {
    console.error("Failed to update pending transfer:", error)
    return Response.json({ error: "Failed to update transfer" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const transfer = await prisma.pendingTransfer.findUnique({ where: { id } })
    if (!transfer) {
      return Response.json({ error: "Transfer not found" }, { status: 404 })
    }
    if (auth.pubkey !== transfer.senderPubkey && auth.pubkey !== transfer.recipientPubkey) {
      return Response.json({ error: "You're not part of this transfer." }, { status: 403 })
    }

    await prisma.pendingTransfer.delete({ where: { id } })
    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to delete pending transfer:", error)
    return Response.json({ error: "Failed to delete transfer" }, { status: 500 })
  }
}
