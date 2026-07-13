import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { readVaultBalanceSummary } from "@/lib/contract"
import type { Vault } from "@prisma/client"

async function serializeWithChainState(vault: Vault, pubkey: string) {
  const base = {
    ...vault,
    onChainVaultId: vault.onChainVaultId.toString(),
  }

  try {
    const summary = await readVaultBalanceSummary(vault.onChainVaultId.toString(), pubkey)
    if (!summary) {
      // Chain read failed or contract not configured — fall back to last-known DB values
      // rather than showing nothing.
      return base
    }

    return {
      ...base,
      balance: summary.balance,
      targetAmount: summary.goalAmount,
      status: summary.status,
      progress: summary.progress,
      withdrawable: summary.withdrawable,
      lockUntil: summary.lockUntil,
      lockLabel: summary.lockLabel,
    }
  } catch (error) {
    console.error(`Chain read failed for vault ${vault.id} (onChainVaultId ${vault.onChainVaultId}):`, error)
    // Don't let one bad chain read fail the whole list — return last-known DB state.
    return base
  }
}

export async function GET(request: Request) {
  try {
    const auth = await verifyAuth(request)

    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pubkey = auth.pubkey

    const [ownedVaults, memberships] = await Promise.all([
      prisma.vault.findMany({
        where: { ownerPubkey: pubkey },
        orderBy: { createdAt: "desc" },
      }),
      prisma.vaultMember.findMany({
        where: { pubkey, role: { not: "Owner" } },
        include: { vault: true },
        orderBy: { vault: { createdAt: "desc" } },
      }),
    ])

    const joinedVaults = memberships
      .map((m) => m.vault)
      .filter((v): v is Vault => v !== null)

    // Read on-chain state for every vault in parallel — owned and joined alike.
    const [owned, joined] = await Promise.all([
      Promise.all(ownedVaults.map((v) => serializeWithChainState(v, pubkey))),
      Promise.all(joinedVaults.map((v) => serializeWithChainState(v, pubkey))),
    ])

    return Response.json({ owned, joined })
  } catch (error) {
    console.error("Vault fetch error:", error)
    return Response.json(
      { error: "Failed to fetch vaults" },
      { status: 500 }
    )
  }
}
