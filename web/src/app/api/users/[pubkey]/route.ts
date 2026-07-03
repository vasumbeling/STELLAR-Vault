import "dotenv/config"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pubkey: string }> }
) {
  const { pubkey } = await params

  const user = await prisma.user.findUnique({
    where: { pubkey }
  })

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 })
  }

  return Response.json(user)
}