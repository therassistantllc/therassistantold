// File: components/clearinghouse/EdiTransactionLog.tsx
"use client";

import { useState } from "react";
import type { EdiTransaction } from "@/types/clearinghouse";

export default function EdiTransactionLog({ rows }: { rows: EdiTransaction[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {row.transaction_type} • {row.direction} • {row.status}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Control: {row.control_number ?? "—"} • Correlation: {row.correlation_id ?? "—"}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Sent: {row.sent_at ?? "—"} • Received: {row.received_at ?? "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(openId === row.id ? null : row.id)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50"
            >
              {openId === row.id ? "Hide Raw Payloads" : "Show Raw Payloads"}
            </button>
          </div>

          {openId === row.id ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                {row.raw_request ?? "No raw request stored."}
              </pre>
              <pre className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                {row.raw_response ?? "No raw response stored."}
              </pre>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
