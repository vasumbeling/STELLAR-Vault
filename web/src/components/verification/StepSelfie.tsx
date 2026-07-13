import { useState } from "react";
import { Camera, RotateCcw, Check, X, ChevronRight } from "lucide-react";
import { StepHeader, PrimaryButton } from "./Shared";
import { StepProps } from "./Types";

type ScanStatus = "idle" | "scanning" | "done" | "failed";

// Mock liveness check — replace with your real SDK call (e.g. face-api.js
// blink/head-turn detection). Reject with an Error to simulate failure paths
// (no face detected, blink not registered, camera permission denied, etc).
function livenessCheck(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 1800);
  });
}

export default function StepSelfie({ data, setData, onNext, onBack }: StepProps) {
  const [status, setStatus] = useState<ScanStatus>(data.selfieCaptured ? "done" : "idle");

  const runScan = () => {
    setStatus("scanning");
    livenessCheck()
      .then(() => {
        setStatus("done");
        setData({ ...data, selfieCaptured: true });
      })
      .catch(() => setStatus("failed"));
  };

  return (
    <div>
      <StepHeader
        title="Take a quick selfie"
        subtitle="We'll check that a real person is present. This isn't stored anywhere except to confirm the match with your ID."
        onBack={onBack}
      />

      <div className="flex flex-col items-center mb-8">
        <div
          className={`w-48 h-48 rounded-full border-4 flex items-center justify-center mb-5 transition-all ${
            status === "done"
              ? "border-green-400 bg-green-50"
              : status === "scanning"
              ? "border-orange-400 bg-orange-50 animate-pulse"
              : status === "failed"
              ? "border-red-300 bg-red-50"
              : "border-neutral-200 bg-neutral-50"
          }`}
        >
          {status === "done" ? (
            <Check size={48} className="text-green-500" />
          ) : status === "scanning" ? (
            <RotateCcw size={36} className="text-orange-400 animate-spin" />
          ) : status === "failed" ? (
            <X size={40} className="text-red-400" />
          ) : (
            <Camera size={36} className="text-neutral-300" />
          )}
        </div>

        <p className="text-sm font-medium text-neutral-600">
          {status === "done"
            ? "Liveness confirmed"
            : status === "scanning"
            ? "Hold still, checking…"
            : status === "failed"
            ? "We couldn't confirm it was you"
            : "Center your face in the frame"}
        </p>
        {status === "idle" && (
          <p className="text-xs text-neutral-400 mt-1 text-center max-w-[220px]">
            We'll ask you to blink or turn your head slightly
          </p>
        )}
        {status === "failed" && (
          <p className="text-xs text-neutral-400 mt-1 text-center max-w-[220px]">
            Make sure you're in good lighting and try again
          </p>
        )}
      </div>

      {status !== "done" ? (
        <PrimaryButton onClick={runScan} disabled={status === "scanning"} icon={Camera}>
          {status === "scanning" ? "Scanning…" : status === "failed" ? "Try again" : "Start face scan"}
        </PrimaryButton>
      ) : (
        <PrimaryButton onClick={onNext} icon={ChevronRight}>
          Continue
        </PrimaryButton>
      )}
    </div>
  );
}