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

  const user = await prisma.user.create({
    data: {
      pubkey: body.pubkey,
      username: body.username,
      avatarUrl: body.avatarUrl,
    }
  })

  return Response.json(user, { status: 201 })
}