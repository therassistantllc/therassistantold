"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimStatusInquiryRecord, ClaimSubmissionRecord, PaymentPostingRecord } from "@/lib/types";

type TransactionType = "claim" | "submission" | "status" | "payment";

type TransactionRow = {
  id: string;
  type: TransactionType;
  date: string | null;
  status: string | null;
  reference: string | null;
  claim_id: string | null;
  amount: string | number | null;
  summary: string | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

export default function BillingTransactionsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [submissions, setSubmissions] = useState<ClaimSubmissionRecord[]>([]);
  const [statuses, setStatuses] = useState<ClaimStatusInquiryRecord[]>([]);
  const [payments, setPayments] = useState<PaymentPostingRecord[]>([]);
  const [filter, setFilter] = useState<TransactionType | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      setLoading(true);
      setError(null);

      const [claimResp, submissionResp, statusResp, paymentResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(150),
        supabase.from("claim_submissions").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(150),
        supabase.from("claim_status_inquiries").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(150),
        supabase.from("payment_postings").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(150),
      ]);

      if (!active) return;
      const firstError = claimResp.error ?? submissionResp.error ?? statusResp.error ?? paymentResp.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setClaims((claimResp.data ?? []) as ClaimRecord[]);
      setSubmissions((submissionResp.data ?? []) as ClaimSubmissionRecord[]);
      setStatuses((statusResp.data ?? []) as ClaimStatusInquiryRecord[]);
      setPayments((paymentResp.data ?? []) as PaymentPostingRecord[]);
      setLoading(false);
    }

    void loadTransactions();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<TransactionRow[]>(() => {
    const built: TransactionRow[] = [
      ...claims.map((claim) => ({
        id: claim.id,
        type: "claim" as const,
        date: claim.created_at ?? null,
        status: claim.claim_status ?? null,
        reference: claim.claim_number ?? claim.id,
        claim_id: claim.id,
        amount: claim.total_charge_amount ?? null,
        summary: "Claim created or updated",
      })),
      ...submissions.map((submission) => ({
        id: submission.id,
        type: "submission" as const,
        date: submission.submitted_at ?? submission.created_at ?? null,
        status: submission.submission_status ?? null,
        reference: submission.clearinghouse_reference ?? submission.external_transaction_id ?? submission.id,
        claim_id: submission.claim_id ?? null,
        amount: null,
        summary: submission.response_summary ?? "Claim submission activity",
      })),
      ...statuses.map((status) => ({
        id: status.id,
        type: "status" as const,
        date: status.received_at ?? status.created_at ?? null,
        status: status.inquiry_status ?? status.payer_status_code ?? null,
        reference: status.external_transaction_id ?? status.id,
        claim_id: status.claim_id ?? null,
        amount: null,
        summary: status.response_summary ?? status.payer_status_text ?? "Claim status inquiry",
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        type: "payment" as const,
        date: payment.posted_at ?? payment.created_at ?? null,
        status: payment.posting_status ?? null,
        reference: payment.posting_reference ?? payment.payment_import_item_id ?? payment.id,
        claim_id: null,
        amount: payment.total_posted_amount ?? null,
        summary: payment.note ?? "Payment posting activity",
      })),
    ];

    return built.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  }, [claims, submissions, statuses, payments]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = filter === "all" || row.type === filter;
      const haystack = [row.id, row.type, row.status, row.reference, row.claim_id, row.summary].join(" ").toLowerCase();
      return matchesType && (!q || haystack.includes(q));
    });
  }, [rows, filter, search]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Reports & Tools</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">Billing Transactions</h1>
            <p className="mt-2 text-sm text-slate-600">Unified transaction queue across claims, submissions, status inquiries, and payment postings.</p>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric label="All transactions" value={String(rows.length)} />
            <Metric label="Claims" value={String(claims.length)} />
            <Metric label="Submissions" value={String(submissions.length)} />
            <Metric label="Payments" value={String(payments.length)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search status, reference, claim ID, transaction ID, or summary" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as TransactionType | "all")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
              <option value="all">All types</option>
              <option value="claim">Claims</option>
              <option value="submission">Submissions</option>
              <option value="status">Status inquiries</option>
              <option value="payment">Payments</option>
            </select>
          </div>

          {loading ? <Empty text="Loading billing transactions..." /> : error ? <ErrorBox text={error} /> : filteredRows.length === 0 ? <Empty text="No billing transactions found." /> : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Summary</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`}>
                        <td className="px-4 py-3">{formatDateTime(row.date)}</td>
                        <td className="px-4 py-3 font-bold capitalize">{row.type}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.reference ?? "—"}</td>
                        <td className="px-4 py-3">{row.status ?? "—"}</td>
                        <td className="px-4 py-3">{formatMoney(row.amount)}</td>
                        <td className="px-4 py-3">{row.summary ?? "—"}</td>
                        <td className="px-4 py-3">
                          {row.claim_id ? <Link href={`/claims/${row.claim_id}`} className="font-bold text-indigo-700 hover:text-indigo-900">Claim</Link> : row.type === "payment" ? <Link href="/billing/payment-postings" className="font-bold text-indigo-700 hover:text-indigo-900">Payments</Link> : <span className="text-slate-400">—</span>}
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
