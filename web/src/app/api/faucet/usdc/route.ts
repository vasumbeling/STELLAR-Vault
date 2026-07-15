import "dotenv/config"
import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk"
import { verifyAuth } from "@/lib/verifyAuth"
import { NETWORK_PASSPHRASE, HORIZON_URL, USDC_ISSUER } from "@/lib/stellar"


const horizon = new Horizon.Server(HORIZON_URL)


export async function POST(request: Request) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const issuerSecret = process.env.USDC_ISSUER_SECRET
  if (!issuerSecret) {
    console.error("USDC_ISSUER_SECRET is not configured")
    return Response.json(
      { error: "The faucet is not configured. Please contact support." },
      { status: 500 },
    )
  }

  let amount: string
  try {
    const body = await request.json()
    const parsed = Number(body?.amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return Response.json({ error: "Please provide a valid positive amount." }, { status: 400 })
    }
    // Cap — this is a test faucet, not a real payment endpoint.
    const capped = Math.min(parsed, 1000)
    amount = capped.toFixed(7)
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 })
  }

  try {
    const issuerKeypair = Keypair.fromSecret(issuerSecret)
    const usdcAsset = new Asset("USDC", USDC_ISSUER)

    const issuerAccount = await horizon.loadAccount(issuerKeypair.publicKey())

    const tx = new TransactionBuilder(issuerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: auth.pubkey,
          asset: usdcAsset,
          amount,
        }),
      )
      .setTimeout(30)
      .build()

    tx.sign(issuerKeypair)
    await horizon.submitTransaction(tx)

    return Response.json({ amount })
  } catch (error: unknown) {
   console.error("Faucet funding failed:", error)

    // Horizon wraps operation-level failures in extras.result_codes
    const resultCodes = (error as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } } })
      ?.response?.data?.extras?.result_codes?.operations

    if (resultCodes?.includes("op_no_trust")) {
      return Response.json(
        { error: "Your wallet needs to establish a USDC trustline before it can receive test USDC." },
        { status: 400 },
      )
    }

    if (resultCodes?.includes("op_no_destination")) {
      return Response.json(
        { error: "Your wallet account doesn't exist on the network yet. Fund it with testnet XLM first." },
        { status: 400 },
      )
    }

    return Response.json(
      { error: "Failed to fund your wallet with test USDC. Please try again." },
      { status: 500 },
    )
  }
}
