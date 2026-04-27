// File: app/payments/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { PaymentPostingRecord } from "@/lib/types";

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

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentPostingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("payment_postings")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as PaymentPostingRecord[]);
      setLoading(false);
    }

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const totalPosted = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const value = Number.parseFloat(String(row.total_posted_amount ?? "0"));
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [rows]
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="mt-2 text-sm text-gray-600">Aligned to your real payment_postings schema.</p>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">Total posted amount</div>
            <div className="mt-1 text-2xl font-semibold text-gray-900">{formatMoney(totalPosted)}</div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading payments...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load payments: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Import item</th>
                      <th className="px-4 py-3">Posting reference</th>
                      <th className="px-4 py-3">Total posted</th>
                      <th className="px-4 py-3">Posted at</th>
                      <th className="px-4 py-3">Reversed at</th>
                      <th className="px-4 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No payment postings found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.posting_status ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.payment_import_item_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.posting_reference ?? "—"}</td>
                          <td className="px-4 py-3">{formatMoney(row.total_posted_amount)}</td>
                          <td className="px-4 py-3">{formatDateTime(row.posted_at)}</td>
                          <td className="px-4 py-3">{formatDateTime(row.reversed_at)}</td>
                          <td className="px-4 py-3">{row.note ?? "—"}</td>
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
