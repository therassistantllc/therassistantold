"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

type StatementRow = {
  client_id: string | null;
  claim_count: number;
  balance: number;
  oldest_claim_date: string | null;
  latest_claim_date: string | null;
  statement_status: "ready" | "review";
  issue: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function PatientStatementsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [serviceLines, setServiceLines] = useState<ClaimServiceLineRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "ready" | "review">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const [claimsResp, linesResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500),
        supabase.from("claim_service_lines").select("*").is("archived_at", null).limit(5000),
      ]);

      if (!active) return;
      const firstError = claimsResp.error ?? linesResp.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setClaims((claimsResp.data ?? []) as ClaimRecord[]);
      setServiceLines((linesResp.data ?? []) as ClaimServiceLineRecord[]);
      setLoading(false);
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<StatementRow[]>(() => {
    const paidByClaim = new Map<string, number>();

    for (const line of serviceLines) {
      if (!line.claim_id) continue;
      const paid = Number.parseFloat(String(line.paid_amount ?? "0"));
      paidByClaim.set(line.claim_id, (paidByClaim.get(line.claim_id) ?? 0) + (Number.isFinite(paid) ? paid : 0));
    }

    const grouped = new Map<string, StatementRow>();

    for (const claim of claims) {
      const charge = Number.parseFloat(String(claim.total_charge_amount ?? "0"));
      const totalCharge = Number.isFinite(charge) ? charge : 0;
      const paid = paidByClaim.get(claim.id) ?? 0;
      const balance = Math.max(0, totalCharge - paid);
      if (balance <= 0) continue;

      const key = claim.client_id ?? "unassigned";
      const existing = grouped.get(key) ?? {
        client_id: claim.client_id ?? null,
        claim_count: 0,
        balance: 0,
        oldest_claim_date: claim.created_at ?? null,
        latest_claim_date: claim.created_at ?? null,
        statement_status: claim.client_id ? "ready" : "review",
        issue: claim.client_id ? null : "Missing patient/client link",
      };

      existing.claim_count += 1;
      existing.balance += balance;

      if (claim.created_at && (!existing.oldest_claim_date || new Date(claim.created_at) < new Date(existing.oldest_claim_date))) existing.oldest_claim_date = claim.created_at;
      if (claim.created_at && (!existing.latest_claim_date || new Date(claim.created_at) > new Date(existing.latest_claim_date))) existing.latest_claim_date = claim.created_at;
      if (!claim.client_id) {
        existing.statement_status = "review";
        existing.issue = "One or more balances are not linked to a patient account";
      }

      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).sort((a, b) => b.balance - a.balance);
  }, [claims, serviceLines]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all" || row.statement_status === filter;
      const haystack = [row.client_id, row.statement_status, row.issue].join(" ").toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [rows, filter, search]);

  const readyCount = rows.filter((row) => row.statement_status === "ready").length;
  const reviewCount = rows.filter((row) => row.statement_status === "review").length;
  const totalBalance = rows.reduce((sum, row) => sum + row.balance, 0);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Patient Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Patient Statements Queue</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Review patient accounts with open responsibility and determine which accounts are ready for statement generation.</p>
            </div>
            <Link href="/billing/batch-statements" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Batch Statements</Link>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric label="Accounts" value={String(rows.length)} />
            <Metric label="Ready" value={String(readyCount)} />
            <Metric label="Needs Review" value={String(reviewCount)} />
            <Metric label="Open Balance" value={formatMoney(totalBalance)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patient/client ID or issue" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "ready" | "review")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
              <option value="all">All statement accounts</option>
              <option value="ready">Ready</option>
              <option value="review">Needs review</option>
            </select>
          </div>

          {loading ? <Empty text="Loading statement queue..." /> : error ? <ErrorBox text={error} /> : filteredRows.length === 0 ? <Empty text="No statement accounts found." /> : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Claims</th><th className="px-4 py-3">Oldest</th><th className="px-4 py-3">Latest</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredRows.map((row) => (
                      <tr key={row.client_id ?? "unassigned"}>
                        <td className="px-4 py-3 font-mono text-xs">{row.client_id ?? "Unassigned"}</td>
                        <td className="px-4 py-3">{row.claim_count}</td>
                        <td className="px-4 py-3">{formatDate(row.oldest_claim_date)}</td>
                        <td className="px-4 py-3">{formatDate(row.latest_claim_date)}</td>
                        <td className="px-4 py-3 font-bold text-slate-950">{formatMoney(row.balance)}</td>
                        <td className="px-4 py-3">{row.statement_status === "ready" ? "Ready" : row.issue ?? "Needs review"}</td>
                        <td className="px-4 py-3">{row.client_id ? <Link href={`/patients/${row.client_id}/patient-billing`} className="font-bold text-indigo-700 hover:text-indigo-900">Open billing tab</Link> : <Link href="/billing/ar" className="font-bold text-indigo-700 hover:text-indigo-900">Review A/R</Link>}</td>
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
