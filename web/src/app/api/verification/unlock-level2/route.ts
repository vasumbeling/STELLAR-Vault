import "dotenv/config"
import { prisma } from "@/lib/prisma"
import { verifyAuth } from "@/lib/verifyAuth"
import { server } from "@/lib/stellar"
import { LEVEL_2_UNLOCK_FEE_XLM } from "@/lib/VerificationGate"

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS!

export async function POST(request: Request) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { txHash } = await request.json()
  if (!txHash) {
    return Response.json({ error: "Missing transaction hash" }, { status: 400 })
  }

  try {
    const tx = await server.getTransaction(txHash)
    if (tx.status !== "SUCCESS") {
      return Response.json({ error: "Transaction was not successful" }, { status: 400 })
    }

    const horizonRes = await fetch(
      `${process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org"}/transactions/${txHash}/operations`
    )
    const horizonData = await horizonRes.json()
    const paymentOp = horizonData._embedded?.records?.find((op: any) => op.type === "payment")

    if (!paymentOp) {
      return Response.json({ error: "No payment operation found in transaction" }, { status: 400 })
    }

    const isCorrectSender = paymentOp.from === auth.pubkey
    const isCorrectDestination = paymentOp.to === TREASURY_ADDRESS
    const isCorrectAsset = paymentOp.asset_type === "native"
    const isSufficientAmount = parseFloat(paymentOp.amount) >= LEVEL_2_UNLOCK_FEE_XLM

    if (!isCorrectSender || !isCorrectDestination || !isCorrectAsset || !isSufficientAmount) {
      return Response.json(
        { error: "Payment does not match the required unlock fee, sender, or destination" },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { pubkey: auth.pubkey },
      data: {
        level2GateUnlockedAt: new Date(),
        level2GateUnlockMethod: "payment",
      },
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error("Level 2 unlock verification error:", error)
    return Response.json({ error: "Failed to verify payment" }, { status: 500 })
  }
}