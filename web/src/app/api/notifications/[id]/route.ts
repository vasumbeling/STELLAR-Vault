import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const notification = await prisma.notification.findUnique({ where: { id } })

    if (!notification) {
      return Response.json({ error: "Notification not found" }, { status: 404 })
    }
    if (notification.pubkey !== auth.pubkey) {
      return Response.json({ error: "Not your notification" }, { status: 403 })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("Notification update error:", error)
    return Response.json({ error: "Failed to update notification" }, { status: 500 })
  }
}
