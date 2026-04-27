// File: app/clearinghouse/transactions/page.tsx
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import EdiTransactionLog from "@/components/clearinghouse/EdiTransactionLog";
import type { EdiTransaction } from "@/types/clearinghouse";

export default function ClearinghouseTransactionsPage() {
  const [rows, setRows] = useState<EdiTransaction[]>([]);
  const [transactionType, setTransactionType] = useState("");
  const [status, setStatus] = useState("");
  const [patientId, setPatientId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const search = new URLSearchParams();
    if (transactionType) search.set("transaction_type", transactionType);
    if (status) search.set("status", status);
    if (patientId) search.set("patient_id", patientId);
    if (claimId) search.set("claim_id", claimId);

    const response = await fetch(`/api/clearinghouse/transactions?${search.toString()}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Could not load transaction history.");
      setLoading(false);
      return;
    }

    setRows((payload.rows ?? []) as EdiTransaction[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Clearinghouse Transactions</h1>
            <p className="mt-2 text-sm text-gray-600">
              Searchable API-level transaction log for eligibility, claim status, submissions, acknowledgments, and errors.
            </p>
          </div>

          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-4">
              <input value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Patient ID" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input value={claimId} onChange={(e) => setClaimId(e.target.value)} placeholder="Claim ID" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm">
                <option value="">All transaction types</option>
                <option value="270">270</option>
                <option value="271">271</option>
                <option value="276">276</option>
                <option value="277">277</option>
                <option value="837">837</option>
                <option value="835">835</option>
                <option value="999">999</option>
                <option value="277CA">277CA</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm">
                <option value="">All statuses</option>
                <option value="created">created</option>
                <option value="sent">sent</option>
                <option value="received">received</option>
                <option value="parsed">parsed</option>
                <option value="failed">failed</option>
              </select>
            </div>

            <button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
              Search
            </button>
          </section>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading transaction log...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : (
            <EdiTransactionLog rows={rows} />
          )}
        </div>
      </main>
    </AppShell>
  );
}
