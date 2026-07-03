import jwt from "jsonwebtoken"

export function verifyAuth(request: Request): { pubkey: string } | null {
  const authHeader = request.headers.get("authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.replace("Bearer ", "").trim()

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { pubkey: string }
    return { pubkey: payload.pubkey }
  } catch (error) {
    // Token expired, tampered, or invalid signature
    return null
  }
}