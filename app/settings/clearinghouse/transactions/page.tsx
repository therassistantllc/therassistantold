// File: app/settings/clearinghouse/transactions/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import type { ExternalTransaction } from "@/types/integrations";

export default function TransactionLogPage() {
  const [transactions, setTransactions] = useState<ExternalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/transactions");
      if (!response.ok) {
        throw new Error("Failed to load transactions");
      }

      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }

  const filteredTransactions = transactions.filter((txn) => {
    if (filterType !== "all" && txn.transaction_type !== filterType) {
      return false;
    }
    if (filterStatus !== "all" && txn.processing_status !== filterStatus) {
      return false;
    }
    return true;
  });

  function formatTimestamp(timestamp?: string) {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleString();
  }

  function getStatusBadge(status?: string) {
    const statusMap: Record<string, string> = {
      completed: "success",
      processing: "info",
      queued: "warning",
      failed: "error",
      cancelled: "error",
    };
    return `badge-${statusMap[status || ""] || "info"}`;
  }

  return (
    <AppShell>
      <main className="min-h-screen" style={{ background: "var(--neutral-50)" }}>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--brand-navy)" }}>
                Transaction Log
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--neutral-600)" }}>
                View all clearinghouse transactions, test connections, and API calls.
              </p>
            </div>
            <Link href="/settings/clearinghouse" className="btn-secondary">
              Back to Settings
            </Link>
          </div>

          <div className="card mb-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase" style={{ color: "var(--neutral-500)" }}>
                  Filter by Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="input-field"
                >
                  <option value="all">All Types</option>
                  <option value="eligibility">Eligibility</option>
                  <option value="claim_status">Claim Status</option>
                  <option value="claim_submission">Claim Submission</option>
                  <option value="payment_posting">Payment Posting</option>
                  <option value="test_connection">Test Connection</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase" style={{ color: "var(--neutral-500)" }}>
                  Filter by Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input-field"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="queued">Queued</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex items-end">
                <button onClick={loadTransactions} className="btn-secondary">
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--neutral-600)" }}>
                Loading transactions...
              </p>
            </div>
          ) : error ? (
            <div
              className="card"
              style={{
                background: "var(--error-bg)",
                borderColor: "var(--error-border)",
                color: "var(--error-text)",
              }}
            >
              {error}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--neutral-600)" }}>
                No transactions found. Run a test connection or eligibility check to see transactions here.
              </p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "var(--table-header)" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Mode
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Sender
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Receiver
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Request Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Response Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: "var(--neutral-700)" }}>
                        Source
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--neutral-200)" }}>
                    {filteredTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3" style={{ color: "var(--neutral-900)" }}>
                          <div className="font-medium">{txn.transaction_type?.replace(/_/g, " ")}</div>
                          {txn.payload_type && (
                            <div className="text-xs" style={{ color: "var(--neutral-500)" }}>
                              {txn.payload_type}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadge(txn.processing_status)}>
                            {txn.processing_status?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge-${txn.processing_mode === "sandbox" ? "warning" : "success"}`}>
                            {txn.processing_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--neutral-600)" }}>
                          {txn.sender_id || "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--neutral-600)" }}>
                          {txn.receiver_id || "—"}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--neutral-600)" }}>
                          {formatTimestamp(txn.request_timestamp)}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--neutral-600)" }}>
                          {formatTimestamp(txn.response_timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          {txn.source_object_type && txn.source_object_id ? (
                            <div className="text-xs">
                              <div style={{ color: "var(--neutral-900)" }}>{txn.source_object_type}</div>
                              <div style={{ color: "var(--neutral-500)" }}>{txn.source_object_id.slice(0, 8)}...</div>
                            </div>
                          ) : (
                            <span style={{ color: "var(--neutral-500)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredTransactions.length > 0 && (
            <div className="mt-4 text-sm" style={{ color: "var(--neutral-600)" }}>
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
