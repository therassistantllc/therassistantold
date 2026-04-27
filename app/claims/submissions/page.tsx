// File: app/claims/submissions/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimSubmissionRecord } from "@/lib/types";

interface SubmissionRow extends ClaimSubmissionRecord {
  claim?: ClaimRecord | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ClaimSubmissionsPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data: submissionData, error: submissionError } = await supabase
        .from("claim_submissions")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (submissionError) {
        setError(submissionError.message);
        setLoading(false);
        return;
      }

      const submissions = (submissionData ?? []) as ClaimSubmissionRecord[];
      const claimIds = submissions.map((item) => item.claim_id).filter(Boolean) as string[];

      let claimsById = new Map<string, ClaimRecord>();
      if (claimIds.length > 0) {
        const { data, error } = await supabase.from("claims").select("*").in("id", claimIds).is("archived_at", null);
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        claimsById = new Map(((data ?? []) as ClaimRecord[]).map((item) => [item.id, item]));
      }

      setRows(submissions.map((item) => ({
        ...item,
        claim: item.claim_id ? claimsById.get(item.claim_id) ?? null : null,
      })));
      setLoading(false);
    }

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => rows, [rows]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Claim Submissions</h1>
            <p className="mt-2 text-sm text-gray-600">Aligned to your real claim_submissions schema.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading claim submissions...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load claim submissions: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">Clearinghouse ref</th>
                      <th className="px-4 py-3">External transaction</th>
                      <th className="px-4 py-3">Payer claim ref</th>
                      <th className="px-4 py-3">Acknowledged</th>
                      <th className="px-4 py-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No claim submissions found.</td></tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.submission_status ?? "—"}</td>
                          <td className="px-4 py-3">{row.claim?.claim_number ?? "—"}</td>
                          <td className="px-4 py-3">{row.clearinghouse_reference ?? "—"}</td>
                          <td className="px-4 py-3">{row.external_transaction_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.payer_claim_reference ?? "—"}</td>
                          <td className="px-4 py-3">{formatDateTime(row.acknowledged_at)}</td>
                          <td className="px-4 py-3">{row.response_summary ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
