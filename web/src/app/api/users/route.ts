import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"

export async function GET() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" }
  })
  return Response.json(users)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.pubkey) {
      return Response.json({ error: "pubkey is required" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { pubkey: body.pubkey } })

    if (existing?.deletedAt) {
      return Response.json({ error: "This account has been deleted" }, { status: 410 })
    }

    // Only require auth for touching an EXISTING record — first-time
    // creation happens during onboarding, before the caller necessarily
    // has an authenticated session yet, so gating that too broke
    // registration entirely. Once a row exists, though, only its owner
    // may update it.
    if (existing) {
      const auth = await verifyAuth(request)
      if (!auth || auth.pubkey !== body.pubkey) {
        return Response.json({ error: "Cannot modify another user's profile" }, { status: 403 })
      }
    }

    const user = await prisma.user.upsert({
      where: { pubkey: body.pubkey },
      update: {
        // Only overwrite fields that were actually provided — avoids
        // accidentally wiping an existing username/avatar with undefined
        // if this route is ever called with a partial payload.
        ...(body.username !== undefined && { username: body.username }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      },
      create: {
        pubkey: body.pubkey,
        username: body.username,
        avatarUrl: body.avatarUrl,
      },
    })

    return Response.json(user, { status: 201 })
  } catch (error) {
    console.error("User upsert error:", error)
    return Response.json({ error: "Failed to save user" }, { status: 500 })
  }
}