import "dotenv/config"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  })
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.pubkey) {
    return Response.json({ error: "pubkey is required" }, { status: 400 })
  }

  // Upsert instead of create: safe to call on every successful login,
  // not just first-time registration. Won't throw on an existing pubkey.
  const user = await prisma.user.upsert({
    where: { pubkey: body.pubkey },
    update: {
      // Only overwrite these if actually provided, so a plain login
      // doesn't wipe out a username/avatar set during registration.
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
}