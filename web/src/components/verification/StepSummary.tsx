import { ShieldCheck, Check } from "lucide-react";
import { StepHeader, PrimaryButton } from "./Shared";
import { Level2Data } from "./Types";

interface StepSummaryProps {
  data: Level2Data;
  onBack: () => void;
  onSubmit: () => void;
  submitted: boolean;
}

const idTypeLabels: Record<string, string> = {
  school: "School ID",
  employer: "Employer ID",
  coop: "Cooperative membership ID",
  barangay: "Barangay certificate",
};

export default function StepSummary({ data, onBack, onSubmit, submitted }: StepSummaryProps) {
  const rows = [
    { label: "Mobile number", value: data.phone },
    { label: "Email", value: data.email || "Not provided" },
    data.identityMode === "id"
      ? { label: "Identity document", value: `${idTypeLabels[data.idType] || "—"} · ${data.idNumber}` }
      : { label: "Endorsement code", value: data.endorsementCode },
    { label: "Liveness check", value: data.selfieCaptured ? "Passed" : "Not completed" },
  ];

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mb-5">
          <ShieldCheck size={36} className="text-orange-500" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-2">Verification submitted</h1>
        <p className="text-sm text-neutral-500 max-w-[260px] leading-relaxed mb-8">
          We're reviewing your details. Level 2 unlocks within 24 hours — you'll get a notification the moment it's
          approved.
        </p>
        <button className="text-sm font-semibold text-orange-500">Back to profile</button>
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        title="Review before you submit"
        subtitle="Make sure everything looks right. You can edit any step before confirming."
        onBack={onBack}
      />

      <div className="rounded-2xl border border-neutral-100 divide-y divide-neutral-100 mb-6 overflow-hidden">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3.5">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{r.label}</span>
            <span className="text-sm font-medium text-neutral-800 text-right max-w-[55%] truncate">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 mb-6 px-1">
        <ShieldCheck size={16} className="text-neutral-300 mt-0.5 shrink-0" />
        <p className="text-xs text-neutral-400 leading-relaxed">
          Your details are encrypted at rest and used only to raise your trust score for cross-chain transactions.
          We never share this with third parties.
        </p>
      </div>

      <PrimaryButton onClick={onSubmit} icon={Check}>
        Confirm and submit
      </PrimaryButton>
    </div>
  );
}