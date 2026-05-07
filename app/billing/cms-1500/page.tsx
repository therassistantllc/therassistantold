"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

type CmsStatus = "ready" | "review" | "excluded";

type Cms1500Row = ClaimRecord & {
  line_count: number;
  cms_status: CmsStatus;
  issue: string | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function evaluateCmsClaim(claim: ClaimRecord, lineCount: number): { status: CmsStatus; issue: string | null } {
  if (!claim.client_id) return { status: "review", issue: "Missing patient/client link" };
  if (!claim.claim_number) return { status: "review", issue: "Missing claim number" };
  if (!claim.date_of_service_from) return { status: "review", issue: "Missing date of service" };
  if (!claim.total_charge_amount || Number(claim.total_charge_amount) <= 0) return { status: "review", issue: "Missing or zero charge amount" };
  if (lineCount <= 0) return { status: "review", issue: "No claim service lines" };

  const status = String(claim.claim_status ?? "").toLowerCase();
  if (["paid", "void", "cancelled", "canceled"].some((item) => status.includes(item))) {
    return { status: "excluded", issue: "Claim status is not eligible for CMS-1500 generation" };
  }

  return { status: "ready", issue: null };
}

export default function Cms1500Page() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [serviceLines, setServiceLines] = useState<ClaimServiceLineRecord[]>([]);
  const [filter, setFilter] = useState<CmsStatus | "all">("ready");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const [claimResp, lineResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500),
        supabase.from("claim_service_lines").select("*").is("archived_at", null).limit(5000),
      ]);

      if (!active) return;
      const firstError = claimResp.error ?? lineResp.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      setClaims((claimResp.data ?? []) as ClaimRecord[]);
      setServiceLines((lineResp.data ?? []) as ClaimServiceLineRecord[]);
      setLoading(false);
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<Cms1500Row[]>(() => {
    const linesByClaim = new Map<string, number>();
    for (const line of serviceLines) {
      if (!line.claim_id) continue;
      linesByClaim.set(line.claim_id, (linesByClaim.get(line.claim_id) ?? 0) + 1);
    }

    return claims.map((claim) => {
      const lineCount = linesByClaim.get(claim.id) ?? 0;
      const result = evaluateCmsClaim(claim, lineCount);
      return {
        ...claim,
        line_count: lineCount,
        cms_status: result.status,
        issue: result.issue,
      };
    });
  }, [claims, serviceLines]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesFilter = filter === "all" || row.cms_status === filter;
      const haystack = [row.id, row.claim_number, row.claim_status, row.client_id, row.issue].join(" ").toLowerCase();
      return matchesFilter && (!q || haystack.includes(q));
    });
  }, [rows, filter, search]);

  const readyCount = rows.filter((row) => row.cms_status === "ready").length;
  const reviewCount = rows.filter((row) => row.cms_status === "review").length;
  const totalReadyCharges = rows.filter((row) => row.cms_status === "ready").reduce((sum, row) => sum + (Number(row.total_charge_amount ?? 0) || 0), 0);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Insurance Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">CMS-1500 Queue</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Review professional claims for paper CMS-1500 readiness, exclusions, and missing data before generation.</p>
            </div>
            <Link href="/billing/scrub" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Claim Scrub</Link>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric label="Ready" value={String(readyCount)} />
            <Metric label="Needs Review" value={String(reviewCount)} />
            <Metric label="Total Claims" value={String(rows.length)} />
            <Metric label="Ready Charges" value={formatMoney(totalReadyCharges)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search claim number, patient ID, claim status, or issue" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
            <select value={filter} onChange={(event) => setFilter(event.target.value as CmsStatus | "all")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50">
              <option value="ready">Ready</option>
              <option value="review">Needs review</option>
              <option value="excluded">Excluded</option>
              <option value="all">All claims</option>
            </select>
          </div>

          {loading ? <Empty text="Loading CMS-1500 queue..." /> : error ? <ErrorBox text={error} /> : filteredRows.length === 0 ? <Empty text="No CMS-1500 queue items found." /> : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Claim</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">DOS</th><th className="px-4 py-3">Lines</th><th className="px-4 py-3">Charge</th><th className="px-4 py-3">CMS Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-mono text-xs">{row.claim_number ?? row.id}</td>
                        <td className="px-4 py-3 font-mono text-xs">{row.client_id ?? "—"}</td>
                        <td className="px-4 py-3">{formatDate(row.date_of_service_from)}</td>
                        <td className="px-4 py-3">{row.line_count}</td>
                        <td className="px-4 py-3">{formatMoney(row.total_charge_amount)}</td>
                        <td className="px-4 py-3">{row.cms_status === "ready" ? "Ready" : row.issue ?? row.cms_status}</td>
                        <td className="px-4 py-3"><Link href={`/claims/${row.id}`} className="font-bold text-indigo-700 hover:text-indigo-900">Open claim</Link></td>
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
