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

const FAUCET_AMOUNT = "100"

const horizon = new Horizon.Server(HORIZON_URL)

export async function POST(request: Request) {
  const auth = verifyAuth(request)

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
          amount: FAUCET_AMOUNT,
        }),
      )
      .setTimeout(30)
      .build()

    tx.sign(issuerKeypair)

    await horizon.submitTransaction(tx)

    return Response.json({ amount: FAUCET_AMOUNT })
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