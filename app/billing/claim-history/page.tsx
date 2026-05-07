"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimSubmissionRecord } from "@/lib/types";

type TransmissionState = "accepted" | "rejected" | "pending" | "no_response" | "review";

type SubmissionRow = ClaimSubmissionRecord & {
  claim?: ClaimRecord | null;
  transmission_state: TransmissionState;
  action_label: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function getTransmissionState(row: ClaimSubmissionRecord): TransmissionState {
  const status = String(row.submission_status ?? "").toLowerCase();
  const response = String(row.response_summary ?? "").toLowerCase();

  if (status.includes("reject") || response.includes("reject")) return "rejected";
  if (status.includes("accept") || status.includes("ack") || row.acknowledged_at) return "accepted";
  if (row.submitted_at && !row.acknowledged_at) return "no_response";
  if (status.includes("pending") || status.includes("submitted")) return "pending";
  return "review";
}

function actionForState(state: TransmissionState) {
  if (state === "rejected") return "Correct and resubmit";
  if (state === "no_response") return "Check status";
  if (state === "pending") return "Monitor";
  if (state === "accepted") return "Track adjudication";
  return "Review";
}

export default function ClaimHistoryPage() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [filter, setFilter] = useState<TransmissionState | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: submissionData, error: submissionError } = await supabase
        .from("claim_submissions")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

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

      setRows(submissions.map((submission) => {
        const state = getTransmissionState(submission);
        return {
          ...submission,
          claim: submission.claim_id ? claimsById.get(submission.claim_id) ?? null : null,
          transmission_state: state,
          action_label: actionForState(state),
        };
      }));
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all" || row.transmission_state === filter;
      const haystack = [
        row.id,
        row.claim_id,
        row.claim?.claim_number,
        row.submission_status,
        row.clearinghouse_reference,
        row.external_transaction_id,
        row.payer_claim_reference,
        row.response_summary,
        row.transmission_state,
      ].join(" ").toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => ({
    accepted: rows.filter((row) => row.transmission_state === "accepted").length,
    rejected: rows.filter((row) => row.transmission_state === "rejected").length,
    no_response: rows.filter((row) => row.transmission_state === "no_response").length,
    pending: rows.filter((row) => row.transmission_state === "pending").length,
  }), [rows]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Insurance Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Electronic Claim History</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Transmission lifecycle queue for claim submissions, clearinghouse acknowledgments, rejections, no-response items, and adjudication follow-up.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/billing/rejections" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Rejections</Link>
              <Link href="/claims/status" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Claim Status</Link>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-5">
            <Metric label="Submissions" value={String(rows.length)} />
            <Metric label="Accepted" value={String(counts.accepted)} />
            <Metric label="Rejected" value={String(counts.rejected)} />
            <Metric label="No Response" value={String(counts.no_response)} />
            <Metric label="Pending" value={String(counts.pending)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search claim, clearinghouse ref, payer ref, status, or response" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as TransmissionState | "all")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
              <option value="all">All transmissions</option>
              <option value="rejected">Rejected</option>
              <option value="no_response">No response</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="review">Review</option>
            </select>
          </div>

          {loading ? <Empty text="Loading claim transmission history..." /> : error ? <ErrorBox text={error} /> : filteredRows.length === 0 ? <Empty text="No claim transmissions found." /> : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Clearinghouse Ref</th><th className="px-4 py-3">Payer Ref</th><th className="px-4 py-3">Response</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">{formatDateTime(row.submitted_at ?? row.created_at)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.claim?.claim_number ?? row.claim_id ?? "—"}</td>
                        <td className="px-4 py-3 font-bold capitalize">{row.transmission_state.replaceAll("_", " ")}</td>
                        <td className="px-4 py-3">{row.clearinghouse_reference ?? row.external_transaction_id ?? "—"}</td>
                        <td className="px-4 py-3">{row.payer_claim_reference ?? "—"}</td>
                        <td className="px-4 py-3">{row.response_summary ?? row.submission_status ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {row.claim_id ? <Link href={`/claims/${row.claim_id}`} className="font-bold text-indigo-700 hover:text-indigo-900">Claim</Link> : null}
                            <Link href={row.transmission_state === "rejected" ? "/billing/rejections" : "/claims/status"} className="font-bold text-indigo-700 hover:text-indigo-900">{row.action_label}</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
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

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">{text}</div>; }
function ErrorBox({ text }: { text: string }) { return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 shadow-sm">{text}</div>; }
