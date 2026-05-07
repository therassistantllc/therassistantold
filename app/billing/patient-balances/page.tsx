"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

interface PatientBalanceRow {
  client_id: string | null;
  claim_count: number;
  total_charges: number;
  total_paid: number;
  patient_balance: number;
  oldest_claim_date: string | null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function PatientBalancesPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [serviceLines, setServiceLines] = useState<ClaimServiceLineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBalances() {
      setLoading(true);
      setError(null);

      const [claimsResp, linesResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(500),
        supabase.from("claim_service_lines").select("*").is("archived_at", null).limit(5000),
      ]);

      if (!active) return;

      if (claimsResp.error || linesResp.error) {
        setError(claimsResp.error?.message || linesResp.error?.message || "Could not load patient balances.");
        setLoading(false);
        return;
      }

      setClaims((claimsResp.data ?? []) as ClaimRecord[]);
      setServiceLines((linesResp.data ?? []) as ClaimServiceLineRecord[]);
      setLoading(false);
    }

    void loadBalances();

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const paidByClaim = new Map<string, number>();

    for (const line of serviceLines) {
      if (!line.claim_id) continue;
      const paid = Number.parseFloat(String(line.paid_amount ?? "0"));
      paidByClaim.set(line.claim_id, (paidByClaim.get(line.claim_id) ?? 0) + (Number.isFinite(paid) ? paid : 0));
    }

    const byClient = new Map<string, PatientBalanceRow>();

    for (const claim of claims) {
      const clientKey = claim.client_id ?? "unassigned";
      const total = Number.parseFloat(String(claim.total_charge_amount ?? "0"));
      const charges = Number.isFinite(total) ? total : 0;
      const paid = paidByClaim.get(claim.id) ?? 0;
      const balance = Math.max(0, charges - paid);

      if (balance <= 0) continue;

      const existing = byClient.get(clientKey) ?? {
        client_id: claim.client_id ?? null,
        claim_count: 0,
        total_charges: 0,
        total_paid: 0,
        patient_balance: 0,
        oldest_claim_date: claim.created_at ?? null,
      };

      existing.claim_count += 1;
      existing.total_charges += charges;
      existing.total_paid += paid;
      existing.patient_balance += balance;

      if (claim.created_at && (!existing.oldest_claim_date || new Date(claim.created_at) < new Date(existing.oldest_claim_date))) {
        existing.oldest_claim_date = claim.created_at;
      }

      byClient.set(clientKey, existing);
    }

    return Array.from(byClient.values()).sort((a, b) => b.patient_balance - a.patient_balance);
  }, [claims, serviceLines]);

  const totalBalance = rows.reduce((sum, row) => sum + row.patient_balance, 0);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">Billing</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Patient Balances</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Review patient responsibility balances grouped by patient account. Use A/R Aging for claim-aging analysis.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/billing/ar" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                A/R Aging
              </Link>
              <Link href="/billing/patient-statements" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                Patient Statements
              </Link>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Metric label="Patients with balances" value={String(rows.length)} />
            <Metric label="Open patient balance" value={formatMoney(totalBalance)} />
            <Metric label="Open claims represented" value={String(rows.reduce((sum, row) => sum + row.claim_count, 0))} />
          </div>

          {loading ? (
            <EmptyState text="Loading patient balances..." />
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700 shadow-sm">{error}</div>
          ) : rows.length === 0 ? (
            <EmptyState text="No patient balances found." />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Claims</th>
                      <th className="px-4 py-3">Oldest claim</th>
                      <th className="px-4 py-3">Charges</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr key={row.client_id ?? "unassigned"} className="text-sm text-slate-700">
                        <td className="px-4 py-3 font-mono text-xs">{row.client_id ?? "Unassigned"}</td>
                        <td className="px-4 py-3">{row.claim_count}</td>
                        <td className="px-4 py-3">{formatDate(row.oldest_claim_date)}</td>
                        <td className="px-4 py-3">{formatMoney(row.total_charges)}</td>
                        <td className="px-4 py-3">{formatMoney(row.total_paid)}</td>
                        <td className="px-4 py-3 font-bold text-slate-950">{formatMoney(row.patient_balance)}</td>
                        <td className="px-4 py-3">
                          {row.client_id ? (
                            <Link href={`/patients/${row.client_id}/patient-billing`} className="font-bold text-indigo-700 hover:text-indigo-900">
                              Open billing tab
                            </Link>
                          ) : (
                            <span className="text-slate-400">No patient linked</span>
                          )}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">{text}</div>;
}
