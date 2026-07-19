import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { logActivity } from "@/lib/logActivity"
import { readVaultBalanceSummary } from "@/lib/contract"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId } = await params
    const body = await request.json()
    const { name, description } = body

    if (name === undefined && description === undefined) {
      return Response.json(
        { error: "Provide at least one of: name, description" },
        { status: 400 }
      )
    }

    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json(
        { error: "Only the vault owner can edit name or description" },
        { status: 403 }
      )
    }

    if (typeof name === "string" && name.trim().length === 0) {
      return Response.json({ error: "name cannot be empty" }, { status: 400 })
    }

    const updated = await prisma.vault.update({
      where: { id: vaultId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "vault_metadata_updated",
      vaultId: vault.id,
      detail: `Updated name/description of "${vault.name}"`,
    })

    return Response.json({
      ...updated,
      onChainVaultId: updated.onChainVaultId.toString(),
    })
  } catch (error) {
    console.error("Vault metadata update error:", error)
    return Response.json({ error: "Failed to update vault" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request)
    if (!auth) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: vaultId } = await params
    const vault = await prisma.vault.findUnique({ where: { id: vaultId } })
    if (!vault) {
      return Response.json({ error: "Vault not found" }, { status: 404 })
    }

    if (vault.ownerPubkey !== auth.pubkey) {
      return Response.json({ error: "Only the vault owner can delete this vault" }, { status: 403 })
    }

    if (vault.vaultType !== "Personal") {
      return Response.json(
        { error: "Collaborative vaults must be deleted via the proposal system" },
        { status: 400 }
      )
    }

    if (vault.status === "Closed") {
      return Response.json({ error: "Vault is already closed" }, { status: 409 })
    }

    // Re-read live on-chain balance rather than trusting the last-known DB
    // value — the client just submitted an on-chain close_vault call, so the
    // DB's cached balance may be stale by the time this request arrives.
    const summary = await readVaultBalanceSummary(vault.onChainVaultId.toString(), auth.pubkey)
    const liveBalance = summary?.balance ?? vault.balance

    if (liveBalance !== 0) {
      return Response.json({ error: "Withdraw all funds before deleting this vault" }, { status: 409 })
    }

    const updated = await prisma.vault.update({
      where: { id: vaultId },
      data: { status: "Closed", balance: liveBalance },
    })

    await logActivity({
      pubkey: auth.pubkey,
      action: "vault_closed",
      vaultId: vault.id,
      detail: `Deleted personal vault "${vault.name}"`,
    })

    return Response.json({
      ...updated,
      onChainVaultId: updated.onChainVaultId.toString(),
    })
  } catch (error) {
    console.error("Vault delete error:", error)
    return Response.json({ error: "Failed to delete vault" }, { status: 500 })
  }
}