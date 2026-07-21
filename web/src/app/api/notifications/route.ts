import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

const VALID_VARIANTS = ["success", "info", "warning", "error", "action_required"] as const

export async function GET(request: Request) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const notifications = await prisma.notification.findMany({
    where: { pubkey: auth.pubkey },
    orderBy: { createdAt: "desc" }
  })

  return Response.json(notifications)
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const message = body?.message
  const vaultId = body?.vaultId ?? null
  const variant = body?.variant ?? "info"
  const meta = body?.meta ?? null

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 })
  }

  if (typeof variant !== "string" || !VALID_VARIANTS.includes(variant as (typeof VALID_VARIANTS)[number])) {
    return Response.json({ error: `variant must be one of: ${VALID_VARIANTS.join(", ")}` }, { status: 400 })
  }

  const notification = await prisma.notification.create({
    data: {
      pubkey: auth.pubkey,
      message: message.trim(),
      vaultId,
      variant,
      meta,
    },
  })

  return Response.json(notification, { status: 201 })
}
