"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

type BatchCandidate = {
  client_id: string | null;
  claim_count: number;
  balance: number;
  oldest_claim_date: string | null;
  delivery_status: "ready" | "hold";
  hold_reason: string | null;
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

function daysOld(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export default function BatchStatementsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [serviceLines, setServiceLines] = useState<ClaimServiceLineRecord[]>([]);
  const [minimumBalance, setMinimumBalance] = useState("10");
  const [minimumAge, setMinimumAge] = useState("0");
  const [filter, setFilter] = useState<"all" | "ready" | "hold">("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCandidates() {
      setLoading(true);
      setError(null);

      const [claimsResp, linesResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(750),
        supabase.from("claim_service_lines").select("*").is("archived_at", null).limit(7500),
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

    void loadCandidates();
    return () => {
      active = false;
    };
  }, []);

  const candidates = useMemo<BatchCandidate[]>(() => {
    const paidByClaim = new Map<string, number>();

    for (const line of serviceLines) {
      if (!line.claim_id) continue;
      const paid = Number.parseFloat(String(line.paid_amount ?? "0"));
      paidByClaim.set(line.claim_id, (paidByClaim.get(line.claim_id) ?? 0) + (Number.isFinite(paid) ? paid : 0));
    }

    const grouped = new Map<string, BatchCandidate>();

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
        delivery_status: claim.client_id ? "ready" : "hold",
        hold_reason: claim.client_id ? null : "Missing patient/client link",
      };

      existing.claim_count += 1;
      existing.balance += balance;
      if (claim.created_at && (!existing.oldest_claim_date || new Date(claim.created_at) < new Date(existing.oldest_claim_date))) {
        existing.oldest_claim_date = claim.created_at;
      }
      if (!claim.client_id) {
        existing.delivery_status = "hold";
        existing.hold_reason = "Missing patient/client link";
      }

      grouped.set(key, existing);
    }

    const minBalance = Number.parseFloat(minimumBalance || "0");
    const minAge = Number.parseInt(minimumAge || "0", 10);

    return Array.from(grouped.values()).map((candidate) => {
      const balanceHold = Number.isFinite(minBalance) && candidate.balance < minBalance;
      const ageHold = Number.isFinite(minAge) && daysOld(candidate.oldest_claim_date) < minAge;
      if (candidate.delivery_status === "hold") return candidate;
      if (balanceHold) return { ...candidate, delivery_status: "hold" as const, hold_reason: `Balance below ${formatMoney(minBalance)}` };
      if (ageHold) return { ...candidate, delivery_status: "hold" as const, hold_reason: `Oldest balance younger than ${minAge} days` };
      return candidate;
    }).sort((a, b) => b.balance - a.balance);
  }, [claims, serviceLines, minimumBalance, minimumAge]);

  const filteredCandidates = candidates.filter((candidate) => filter === "all" || candidate.delivery_status === filter);
  const readyCandidates = candidates.filter((candidate) => candidate.delivery_status === "ready");
  const totalReadyBalance = readyCandidates.reduce((sum, candidate) => sum + candidate.balance, 0);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Patient Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Batch Statements</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Build a statement batch from eligible patient accounts using minimum balance and aging criteria.</p>
            </div>
            <Link href="/billing/patient-statements" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Patient Statements</Link>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric label="Candidate accounts" value={String(candidates.length)} />
            <Metric label="Ready for batch" value={String(readyCandidates.length)} />
            <Metric label="Held" value={String(candidates.length - readyCandidates.length)} />
            <Metric label="Ready balance" value={formatMoney(totalReadyBalance)} />
          </div>

          <div className="mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
            <label className="grid gap-2 text-sm font-bold text-slate-700">Minimum balance<input value={minimumBalance} onChange={(event) => setMinimumBalance(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Minimum account age days<input value={minimumAge} onChange={(event) => setMinimumAge(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" /></label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">Queue filter<select value={filter} onChange={(event) => setFilter(event.target.value as "all" | "ready" | "hold")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"><option value="ready">Ready only</option><option value="hold">Held only</option><option value="all">All candidates</option></select></label>
          </div>

          {loading ? <Empty text="Loading batch statement candidates..." /> : error ? <ErrorBox text={error} /> : filteredCandidates.length === 0 ? <Empty text="No batch statement candidates found." /> : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Claims</th><th className="px-4 py-3">Oldest</th><th className="px-4 py-3">Age</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Batch Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.client_id ?? "unassigned"}>
                        <td className="px-4 py-3 font-mono text-xs">{candidate.client_id ?? "Unassigned"}</td>
                        <td className="px-4 py-3">{candidate.claim_count}</td>
                        <td className="px-4 py-3">{formatDate(candidate.oldest_claim_date)}</td>
                        <td className="px-4 py-3">{daysOld(candidate.oldest_claim_date)} days</td>
                        <td className="px-4 py-3 font-bold text-slate-950">{formatMoney(candidate.balance)}</td>
                        <td className="px-4 py-3">{candidate.delivery_status === "ready" ? "Ready" : candidate.hold_reason ?? "Held"}</td>
                        <td className="px-4 py-3">{candidate.client_id ? <Link href={`/patients/${candidate.client_id}/patient-billing`} className="font-bold text-indigo-700 hover:text-indigo-900">Open account</Link> : <Link href="/billing/ar" className="font-bold text-indigo-700 hover:text-indigo-900">Review A/R</Link>}</td>
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
