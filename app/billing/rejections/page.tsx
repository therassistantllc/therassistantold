// File: app/billing/rejections/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimSubmissionRecord } from "@/lib/types";

interface RejectionRow extends ClaimSubmissionRecord {
  claim?: ClaimRecord | null;
  rejection_reason?: string | null;
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

export default function RejectionsQueuePage() {
  const [rows, setRows] = useState<RejectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: submissionData, error: submissionError } = await supabase
        .from("claim_submissions")
        .select("*")
        .or("submission_status.ilike.%reject%,rejection_reason.not.is.null")
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
        const { data: claimData, error: claimError } = await supabase
          .from("claims")
          .select("*")
          .in("id", claimIds)
          .is("archived_at", null);

        if (!active) return;
        if (claimError) {
          setError(claimError.message);
          setLoading(false);
          return;
        }

        claimsById = new Map(((claimData ?? []) as ClaimRecord[]).map((claim) => [claim.id, claim]));
      }

      setRows(submissions.map((item) => ({
        ...item,
        claim: item.claim_id ? claimsById.get(item.claim_id) ?? null : null,
      })));
      setLoading(false);
    }

    void loadQueue();

    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Submission Rejections Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Rejected submissions that need rebill or correction.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading rejections queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load rejections queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">Claim ID</th>
                      <th className="px-4 py-3">Rejection reason</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No rejections found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.claim?.claim_number ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.claim_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.rejection_reason ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {row.claim_id ? <Link href={`/claims/${row.claim_id}`} className="text-blue-700 hover:underline">Claim Detail</Link> : null}
                              <Link href="/claims/submissions" className="text-blue-700 hover:underline">Submissions</Link>
                              <Link href="/claims/status" className="text-blue-700 hover:underline">Status</Link>
                            </div>
                          </td>
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
