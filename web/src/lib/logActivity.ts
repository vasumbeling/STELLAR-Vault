import { prisma } from "@/lib/prisma"

type LogActivityParams = {
  pubkey: string
  action: string
  vaultId?: string
  detail?: string
}

export async function logActivity({ pubkey, action, vaultId, detail }: LogActivityParams) {
  try {
    await prisma.activityLog.create({
      data: {
        pubkey,
        action,
        vaultId,
        detail,
      }
    })
  } catch (error) {
    // Logging should never break the main action it's attached to —
    // if this fails, log it server-side but don't throw
    console.error("Failed to write activity log:", error)
  }
}