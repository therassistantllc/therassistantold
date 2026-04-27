// File: app/billing/denials/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimStatusInquiryRecord } from "@/lib/types";

interface DenialRow extends ClaimRecord {
  latestInquiry?: ClaimStatusInquiryRecord | null;
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

export default function DenialsQueuePage() {
  const [rows, setRows] = useState<DenialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: claimData, error: claimError } = await supabase
        .from("claims")
        .select("*")
        .ilike("claim_status", "%denied%")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (claimError) {
        setError(claimError.message);
        setLoading(false);
        return;
      }

      const claims = (claimData ?? []) as ClaimRecord[];
      const claimIds = claims.map((item) => item.id);

      let inquiriesByClaim = new Map<string, ClaimStatusInquiryRecord>();
      if (claimIds.length > 0) {
        const { data: inquiryData, error: inquiryError } = await supabase
          .from("claim_status_inquiries")
          .select("*")
          .in("claim_id", claimIds)
          .order("created_at", { ascending: false });

        if (!active) return;
        if (inquiryError) {
          setError(inquiryError.message);
          setLoading(false);
          return;
        }

        for (const item of ((inquiryData ?? []) as ClaimStatusInquiryRecord[])) {
          if (item.claim_id && !inquiriesByClaim.has(item.claim_id)) {
            inquiriesByClaim.set(item.claim_id, item);
          }
        }
      }

      setRows(claims.map((claim) => ({
        ...claim,
        latestInquiry: inquiriesByClaim.get(claim.id) ?? null,
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
            <h1 className="text-2xl font-bold text-gray-900">Denials Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Denied claims that need review, correction, or appeal.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading denials queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load denials queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">Claim ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Total charge</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No denied claims found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.claim_number ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                          <td className="px-4 py-3">{row.claim_status ?? "—"}</td>
                          <td className="px-4 py-3">{formatMoney(row.total_charge_amount)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/claims/${row.id}`} className="text-blue-700 hover:underline">Claim Detail</Link>
                              <Link href="/claims/status" className="text-blue-700 hover:underline">Status</Link>
                              <Link href="/claims/submissions" className="text-blue-700 hover:underline">Submissions</Link>
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
