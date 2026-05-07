"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

type SubmissionRow = {
  id: string;
  claim_id: string | null;
  submission_status: string | null;
  clearinghouse_reference: string | null;
  response_summary: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string | null;
};

export default function ClaimHistoryPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: queryError } = await supabase
        .from("claim_submissions")
        .select("id, claim_id, submission_status, clearinghouse_reference, response_summary, submitted_at, acknowledged_at, created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(400);

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as SubmissionRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-2xl font-black text-slate-950">Electronic Claim History</h1>
          <p className="mt-2 text-sm text-slate-600">Submission and response log for transmitted claims.</p>

          {loading ? <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">Loading...</div> : null}
          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

          {!loading && !error ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Claim</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clearinghouse Ref</th>
                    <th className="px-4 py-3">Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.submitted_at ?? row.created_at ?? "—"}</td>
                      <td className="px-4 py-3">{row.claim_id ?? "—"}</td>
                      <td className="px-4 py-3">{row.submission_status ?? "—"}</td>
                      <td className="px-4 py-3">{row.clearinghouse_reference ?? "—"}</td>
                      <td className="px-4 py-3">{row.response_summary ?? "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No claim submissions found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </main>
    </AppShell>
  );
}
