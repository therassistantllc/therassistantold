// File: components/clearinghouse/ClaimStatusPanel.tsx
"use client";

import { useState } from "react";
import ClaimStatusBadge from "@/components/clearinghouse/ClaimStatusBadge";
import type { ClaimStatusCheck } from "@/types/clearinghouse";

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function ClaimStatusPanel({
  claimId,
  latest,
  onComplete,
}: {
  claimId: string;
  latest: ClaimStatusCheck | null;
  onComplete?: () => Promise<void> | void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runStatus() {
    setRunning(true);
    setError(null);

    const response = await fetch("/api/clearinghouse/claim-status/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Claim status run failed.");
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
          <h3 className="text-lg font-semibold text-gray-900">Claim Status</h3>
          <p className="mt-1 text-sm text-gray-600">
            Real-time 276/277 claim status inquiry.
          </p>
        </div>
        <ClaimStatusBadge status={latest?.status} />
      </div>

      <div className="grid gap-3 text-sm text-gray-700">
        <div><span className="font-medium">Payer:</span> {latest?.payer_name ?? "—"}</div>
        <div><span className="font-medium">Billed Amount:</span> {formatMoney(latest?.billed_amount)}</div>
        <div><span className="font-medium">Paid Amount:</span> {formatMoney(latest?.paid_amount)}</div>
        <div><span className="font-medium">Status Category:</span> {latest?.status_category_code ?? "—"}</div>
        <div><span className="font-medium">Status Code:</span> {latest?.status_code ?? "—"}</div>
        <div><span className="font-medium">Entity Code:</span> {latest?.entity_code ?? "—"}</div>
        <div><span className="font-medium">Last Checked:</span> {latest?.received_at ?? "—"}</div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void runStatus()}
        disabled={running}
        className="mt-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {running ? "Running..." : "Run Claim Status"}
      </button>
    </div>
  );
}
