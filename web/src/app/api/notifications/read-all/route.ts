import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function PATCH(request: Request) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    await prisma.notification.updateMany({
      where: { pubkey: auth.pubkey, read: false },
      data: { read: true },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Mark-all-read error:", error)
    return Response.json({ error: "Failed to mark notifications read" }, { status: 500 })
  }
}
