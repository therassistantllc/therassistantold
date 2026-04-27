// File: app/patients/[id]/patient-billing/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { ClaimRecord, PaymentPostingRecord } from "@/lib/types";

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

export default function PatientBillingPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [payments, setPayments] = useState<PaymentPostingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!patientId) {
        setError("Patient ID is missing.");
        setLoading(false);
        return;
      }

      const claimResp = await supabase
        .from("claims")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (claimResp.error) {
        setError(claimResp.error.message);
        setLoading(false);
        return;
      }

      const claimRows = (claimResp.data ?? []) as ClaimRecord[];
      setClaims(claimRows);

      const paymentResp = await supabase
        .from("payment_postings")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (paymentResp.error) {
        setError(paymentResp.error.message);
        setLoading(false);
        return;
      }

      setPayments((paymentResp.data ?? []) as PaymentPostingRecord[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [patientId]);

  const totalCharges = useMemo(() => claims.reduce((sum, item) => sum + Number.parseFloat(String(item.total_charge_amount ?? "0") || "0"), 0), [claims]);
  const totalPayments = useMemo(() => payments.reduce((sum, item) => sum + Number.parseFloat(String(item.total_posted_amount ?? "0") || "0"), 0), [payments]);
  const estimatedBalance = totalCharges - totalPayments;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Billing</h1>
            <p className="mt-2 text-sm text-gray-600">
              Patient balance, statements, payments, open charges, and accounting activity belong here as the patient-level A/R ledger.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/payments" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
              Enter Payment
            </Link>
            <Link href="/billing" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
              Billing Center
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Total balance</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(estimatedBalance)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Charges</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(totalCharges)}</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Payments</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{formatMoney(totalPayments)}</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading patient billing...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Could not load patient billing: {error}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
            {claims.length === 0 ? (
              <div className="mt-4 text-sm text-gray-600">No charges yet.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {claims.map((claim) => (
                  <div key={claim.id} className="rounded-xl border border-gray-200 px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{claim.claim_number ?? "Charge / Claim Record"}</div>
                    <div className="mt-1 text-gray-600">{claim.claim_status ?? "—"} • {formatMoney(claim.total_charge_amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Statements</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-700">
              <div>Generate statement: available from patient billing workflow.</div>
              <div>Statement history: not wired yet.</div>
              <div>Credit cards / payment methods: optional future tab.</div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
