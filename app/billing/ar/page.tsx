// File: app/billing/ar/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

interface AgingRow extends ClaimRecord {
  paidAmount: number;
  balanceAmount: number;
  agingBucket: string;
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

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function bucketForDays(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  return "120+";
}

export default function ARQueuePage() {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const [claimResp, paymentResp] = await Promise.all([
        supabase.from("claims").select("*").is("archived_at", null).order("created_at", { ascending: false }).limit(200),
        supabase.from("claim_service_lines").select("claim_id, paid_amount").is("archived_at", null).limit(2000),
      ]);

      if (!active) return;
      if (claimResp.error || paymentResp.error) {
        setError(claimResp.error?.message || paymentResp.error?.message || "Could not load A/R queue.");
        setLoading(false);
        return;
      }

      const payments = (paymentResp.data ?? []) as ClaimServiceLineRecord[];
      const paidByClaim = new Map<string, number>();
      for (const payment of payments) {
        const claimId = payment.claim_id;
        if (!claimId) continue;
        const amount = Number.parseFloat(String(payment.paid_amount ?? "0"));
        paidByClaim.set(claimId, (paidByClaim.get(claimId) ?? 0) + (Number.isFinite(amount) ? amount : 0));
      }

      const now = new Date();
      const built = ((claimResp.data ?? []) as ClaimRecord[]).map((claim) => {
        const created = claim.created_at ? new Date(claim.created_at) : now;
        const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
        const total = Number.parseFloat(String(claim.total_charge_amount ?? "0"));
        const paid = paidByClaim.get(claim.id) ?? 0;
        const balance = Math.max(0, (Number.isFinite(total) ? total : 0) - paid);
        return {
          ...claim,
          paidAmount: paid,
          balanceAmount: balance,
          agingBucket: bucketForDays(days),
        };
      }).filter((claim) => claim.balanceAmount > 0);

      setRows(built);
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
            <h1 className="text-2xl font-bold text-gray-900">A/R Aging Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Outstanding balances grouped by claim aging bucket.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading A/R aging queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load A/R aging queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">Bucket</th>
                      <th className="px-4 py-3">Charge</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Balance</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No aging items found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.claim_number ?? "—"}</td>
                          <td className="px-4 py-3">{row.agingBucket}</td>
                          <td className="px-4 py-3">{formatMoney(row.total_charge_amount)}</td>
                          <td className="px-4 py-3">{formatMoney(row.paidAmount)}</td>
                          <td className="px-4 py-3">{formatMoney(row.balanceAmount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/claims/${row.id}`} className="text-blue-700 hover:underline">Claim Detail</Link>
                              <Link href="/claims/status" className="text-blue-700 hover:underline">Status</Link>
                              <Link href="/billing/payment-postings" className="text-blue-700 hover:underline">Payments</Link>
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
