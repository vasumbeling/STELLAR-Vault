import { useState } from "react";
import { Lock, Sparkles, Wallet, ChevronLeft } from "lucide-react";
import { Horizon, TransactionBuilder, Operation, Asset, BASE_FEE } from "@stellar/stellar-sdk";
import { HORIZON_URL, NETWORK_PASSPHRASE } from "@/lib/stellar";
import { walletService, authFetch, signWithCurrentAccount } from "@/lib/wallet";
import { PrimaryButton, inputClass } from "./Shared";
import { getLevel2GateStatus, LEVEL_2_POINTS_REQUIRED, LEVEL_2_UNLOCK_FEE_XLM } from "@/lib/VerificationGate";

interface LevelUpGateProps {
  currentPoints: number;
  onUnlocked: (method: "points" | "payment") => void;
  onClose: () => void;
}

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS!;
const horizonServer = new Horizon.Server(HORIZON_URL);

export default function LevelUpGate({ currentPoints, onUnlocked, onClose }: LevelUpGateProps) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = getLevel2GateStatus(currentPoints);
  const progressPct = Math.min(100, Math.round((currentPoints / LEVEL_2_POINTS_REQUIRED) * 100));

  const handlePay = async () => {
    setError(null);
    setPaying(true);
    try {
      const snapshot = walletService.getSnapshot();
      const publicKey = snapshot.publicKey;
      if (!publicKey || !snapshot.isConnected) {
        throw new Error("Wallet not connected. Please log in and try again.");
      }

      // 1. Build the classic payment transaction
      const account = await horizonServer.loadAccount(publicKey);
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.payment({
            destination: TREASURY_ADDRESS,
            asset: Asset.native(),
            amount: LEVEL_2_UNLOCK_FEE_XLM.toString(),
          })
        )
        .setTimeout(60)
        .build();

      // 2. Sign with whichever signer is active (Freighter or PIN account)
      const signedXdr = await signWithCurrentAccount(tx.toXDR());
      const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

      // 3. Submit to Horizon
      const submitResult = await horizonServer.submitTransaction(signedTx);
      const txHash = submitResult.hash;

      // 4. Verify with backend — authFetch attaches the JWT automatically
      const res = await authFetch("/api/verification/unlock-level2", {
        method: "POST",
        body: JSON.stringify({ txHash }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Verification failed after payment");
      }

      onUnlocked("payment");
    } catch (err: any) {
      console.error("Level 2 unlock payment error:", err);
      setError(err.message ?? "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (status.eligible) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-green-500" />
        </div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">You're eligible for Level 2</h1>
        <p className="text-sm text-neutral-500 mb-6">
          You've got {currentPoints.toLocaleString()} points — enough to start identity verification.
        </p>
        <PrimaryButton onClick={() => onUnlocked("points")}>Start verification</PrimaryButton>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-neutral-400 hover:text-neutral-600 text-sm mb-4 -ml-1 transition-colors"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
        <Lock size={22} className="text-orange-400" />
      </div>

      <h1 className="text-xl font-bold text-neutral-900 mb-1">Almost there</h1>
      <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
        Level 2 unlocks at {LEVEL_2_POINTS_REQUIRED.toLocaleString()} points. You need{" "}
        <span className="font-semibold text-neutral-700">{status.pointsShort.toLocaleString()} more</span>, or you
        can unlock it now.
      </p>

      <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-neutral-400 mb-1.5">
          <span>{currentPoints.toLocaleString()} pts</span>
          <span>{LEVEL_2_POINTS_REQUIRED.toLocaleString()} pts</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-100 p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Wallet size={16} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">Unlock instantly</p>
            <p className="text-xs text-neutral-400">Pay {LEVEL_2_UNLOCK_FEE_XLM} XLM to skip the points wait</p>
          </div>
        </div>
      </div>

      <PrimaryButton onClick={handlePay} disabled={paying}>
        {paying ? "Confirming payment…" : `Pay ${LEVEL_2_UNLOCK_FEE_XLM} XLM to unlock`}
      </PrimaryButton>

      {error && <p className="text-xs text-red-500 text-center mt-3">{error}</p>}

      <p className="text-xs text-neutral-400 text-center mt-4">
        Or keep saving and completing vault cycles to earn points instead.
      </p>
    </div>
  );
}