// File: components/clearinghouse/EligibilityPanel.tsx
"use client";

import { useState } from "react";
import EligibilityBadge from "@/components/clearinghouse/EligibilityBadge";
import type { EligibilityCheck } from "@/types/clearinghouse";

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function EligibilityPanel({
  patientId,
  appointmentId,
  insurancePolicyId,
  latest,
  onComplete,
}: {
  patientId: string;
  appointmentId?: string | null;
  insurancePolicyId?: string | null;
  latest: EligibilityCheck | null;
  onComplete?: () => Promise<void> | void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEligibility() {
    setRunning(true);
    setError(null);

    const response = await fetch("/api/clearinghouse/eligibility/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        appointmentId,
        insurancePolicyId,
        serviceTypeCode: "98",
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Eligibility run failed.");
      setRunning(false);
      return;
    }

    await onComplete?.();
    setRunning(false);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Eligibility</h3>
          <p className="mt-1 text-sm text-gray-600">
            Real-time 270/271 eligibility result for Professional Services (98).
          </p>
        </div>
        <EligibilityBadge eligibility={latest} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
        <div><span className="font-medium">Payer:</span> {latest?.payer_name ?? "—"}</div>
        <div><span className="font-medium">Plan:</span> {latest?.plan_name ?? "—"}</div>
        <div><span className="font-medium">Member ID:</span> {latest?.member_id ?? "—"}</div>
        <div><span className="font-medium">Subscriber:</span> {latest?.subscriber_name ?? "—"}</div>
        <div><span className="font-medium">Copay:</span> {formatMoney(latest?.copay_amount)}</div>
        <div><span className="font-medium">Deductible Remaining:</span> {formatMoney(latest?.deductible_remaining)}</div>
        <div><span className="font-medium">Coinsurance:</span> {latest?.coinsurance_percent ?? "—"}{latest?.coinsurance_percent ? "%" : ""}</div>
        <div><span className="font-medium">Effective Date:</span> {latest?.effective_date ?? "—"}</div>
        <div><span className="font-medium">Termination Date:</span> {latest?.termination_date ?? "—"}</div>
        <div><span className="font-medium">Last Checked:</span> {latest?.checked_at ?? "—"}</div>
      </div>

      {latest?.status === "inactive" ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Coverage is inactive. Review insurance before clinical or billing follow-up.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void runEligibility()}
        disabled={running}
        className="mt-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {running ? "Running..." : "Run Real-Time Eligibility"}
      </button>
    </div>
  );
}
