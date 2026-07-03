import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function GET(request: Request) {
  const auth = verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { pubkey: auth.pubkey },
    orderBy: { createdAt: "desc" }
  })

  return Response.json(notifications)
}