// File: app/billing/payment-exceptions/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, ClaimServiceLineRecord } from "@/lib/types";

interface PaymentExceptionRow extends ClaimServiceLineRecord {
  claimPatientResponsibilityAmount?: string | number | null;
  exceptionReasons: string[];
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

export default function PaymentExceptionsPage() {
  const [rows, setRows] = useState<PaymentExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const [serviceLineResp, claimResp] = await Promise.all([
        supabase
          .from("claim_service_lines")
          .select("*")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("claims")
          .select("id, patient_responsibility_amount, paid_at")
          .is("archived_at", null)
          .limit(2000),
      ]);

      if (!active) return;
      if (serviceLineResp.error || claimResp.error) {
        setError(serviceLineResp.error?.message || claimResp.error?.message || "Could not load payment exceptions.");
        setLoading(false);
        return;
      }

      const claimsById = new Map<string, Pick<ClaimRecord, "id" | "patient_responsibility_amount" | "paid_at">>(
        ((claimResp.data ?? []) as Pick<ClaimRecord, "id" | "patient_responsibility_amount" | "paid_at">[]).map((claim) => [claim.id, claim]),
      );

      const built = ((serviceLineResp.data ?? []) as ClaimServiceLineRecord[]).map((row) => {
        const reasons: string[] = [];
        const linkedClaim = claimsById.get(row.claim_id ?? "") ?? null;
        const paid = Number.parseFloat(String(row.paid_amount ?? "0"));
        const allowed = Number.parseFloat(String(row.allowed_amount ?? "0"));
        const patientResp = Number.parseFloat(String(linkedClaim?.patient_responsibility_amount ?? "0"));

        if (!row.claim_id) reasons.push("Missing claim link");
        if (!row.id) reasons.push("Missing claim service line link");
        if (Number.isFinite(allowed) && Number.isFinite(paid) && paid > allowed) reasons.push("Paid exceeds allowed");
        if (Number.isFinite(patientResp) && patientResp > 0) reasons.push("Patient responsibility review");

        return {
          ...row,
          claimPatientResponsibilityAmount: linkedClaim?.patient_responsibility_amount ?? null,
          exceptionReasons: reasons,
        };
      }).filter((row) => {
        const paid = Number.parseFloat(String(row.paid_amount ?? "0"));
        const linkedClaim = row.claim_id ? claimsById.get(row.claim_id) ?? null : null;
        const hasPostedPaymentActivity = Boolean(linkedClaim?.paid_at) || (Number.isFinite(paid) && paid > 0);
        return hasPostedPaymentActivity && row.exceptionReasons.length > 0;
      });

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
            <h1 className="text-2xl font-bold text-gray-900">Payment Exceptions Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Exceptions and review items after payment posting.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading payment exceptions...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load payment exceptions: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Service Line ID</th>
                      <th className="px-4 py-3">Claim</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Allowed</th>
                      <th className="px-4 py-3">Exceptions</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No payment exceptions found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.claim_id ?? "—"}</td>
                          <td className="px-4 py-3">{formatMoney(row.paid_amount)}</td>
                          <td className="px-4 py-3">{formatMoney(row.allowed_amount)}</td>
                          <td className="px-4 py-3">{row.exceptionReasons.join(", ")}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {row.claim_id ? <Link href={`/claims/${row.claim_id}`} className="text-blue-700 hover:underline">Claim Detail</Link> : null}
                              <Link href="/billing/payment-postings" className="text-blue-700 hover:underline">Payment Posting</Link>
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
