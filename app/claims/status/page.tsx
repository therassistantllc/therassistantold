// File: app/claims/status/page.tsx
"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimStatusInquiryRecord } from "@/lib/types";

interface InquiryRow extends ClaimStatusInquiryRecord {
  claim?: ClaimRecord | null;
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

export default function ClaimStatusPage() {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data: inquiryData, error: inquiryError } = await supabase
        .from("claim_status_inquiries")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (inquiryError) {
        setError(inquiryError.message);
        setLoading(false);
        return;
      }

      const inquiries = (inquiryData ?? []) as ClaimStatusInquiryRecord[];
      const claimIds = inquiries.map((item) => item.claim_id).filter(Boolean) as string[];

      let claimsById = new Map<string, ClaimRecord>();
      if (claimIds.length > 0) {
        const { data, error } = await supabase.from("claims").select("*").in("id", claimIds).is("archived_at", null);
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        claimsById = new Map(((data ?? []) as ClaimRecord[]).map((item) => [item.id, item]));
      }

      setRows(inquiries.map((item) => ({
        ...item,
        claim: item.claim_id ? claimsById.get(item.claim_id) ?? null : null,
      })));
      setLoading(false);
    }

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Claim Status Inquiries</h1>
            <p className="mt-2 text-sm text-gray-600">Aligned to your real claim_status_inquiries schema.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading claim status inquiries...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load claim status inquiries: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Claim number</th>
                      <th className="px-4 py-3">External transaction</th>
                      <th className="px-4 py-3">Payer status code</th>
                      <th className="px-4 py-3">Payer status text</th>
                      <th className="px-4 py-3">Responded</th>
                      <th className="px-4 py-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No claim status inquiries found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.inquiry_status ?? "—"}</td>
                          <td className="px-4 py-3">{row.claim?.claim_number ?? "—"}</td>
                          <td className="px-4 py-3">{row.external_transaction_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.payer_status_code ?? "—"}</td>
                          <td className="px-4 py-3">{row.payer_status_text ?? "—"}</td>
                          <td className="px-4 py-3">{formatDateTime(row.responded_at)}</td>
                          <td className="px-4 py-3">{row.response_summary ?? "—"}</td>
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
