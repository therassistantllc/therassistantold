"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

type EligibilityRequestDetail = {
  id: string;
  organization_id: string | null;
  patient_id: string | null;
  payer_id: string | null;
  payer_name: string | null;
  subscriber_id: string | null;
  subscriber_first_name: string | null;
  subscriber_last_name: string | null;
  subscriber_dob: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  patient_dob: string | null;
  service_type_code: string;
  service_type_description: string;
  request_mode: string;
  status: string;
  eligibility_status: string | null;
  copay_amount: number | null;
  deductible_remaining: number | null;
  effective_date: string | null;
  termination_date: string | null;
  created_at: string;
  availity_transaction_id: string | null;
  request_payload_safe: unknown;
  response_payload_safe: unknown;
};

type AvailityTxSummary = {
  id: string;
  transaction_type: string;
  status: string;
  environment: string;
  request_url: string | null;
  response_status: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function EligibilityRequestReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [request, setRequest] = useState<EligibilityRequestDetail | null>(null);
  const [transaction, setTransaction] = useState<AvailityTxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`/api/eligibility/requests/${id}`);
        const data = await resp.json();

        if (!resp.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to load eligibility report");
        }

        setRequest(data.request as EligibilityRequestDetail);
        setTransaction((data.transaction || null) as AvailityTxSummary | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load eligibility report");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/eligibility/history" className="hover:text-slate-700">Eligibility History</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">Eligibility Report</span>
          </div>

          <h1 className="text-3xl font-black text-slate-950">Eligibility Report</h1>

          {loading && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading report...
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-800">
              {error}
            </div>
          )}

          {!loading && !error && request && (
            <div className="mt-6 grid gap-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Status</h2>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div><span className="font-semibold">Eligibility Status:</span> {request.eligibility_status || "-"}</div>
                  <div><span className="font-semibold">Request Status:</span> {request.status}</div>
                  <div><span className="font-semibold">Request Mode:</span> {request.request_mode}</div>
                  <div>
                    <span className="font-semibold">Service Type:</span> {request.service_type_code} {request.service_type_description}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Coverage</h2>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div><span className="font-semibold">Copay:</span> {money(request.copay_amount)}</div>
                  <div><span className="font-semibold">Deductible Remaining:</span> {money(request.deductible_remaining)}</div>
                  <div><span className="font-semibold">Effective Date:</span> {request.effective_date || "-"}</div>
                  <div><span className="font-semibold">Termination Date:</span> {request.termination_date || "-"}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Payer / Subscriber / Client</h2>
                <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                  <div><span className="font-semibold">Payer:</span> {request.payer_name || "-"} ({request.payer_id || "-"})</div>
                  <div><span className="font-semibold">Subscriber ID:</span> {request.subscriber_id || "-"}</div>
                  <div>
                    <span className="font-semibold">Subscriber:</span> {`${request.subscriber_first_name || ""} ${request.subscriber_last_name || ""}`.trim() || "-"}
                  </div>
                  <div><span className="font-semibold">Subscriber DOB:</span> {request.subscriber_dob || "-"}</div>
                  <div>
                    <span className="font-semibold">Client:</span> {`${request.patient_first_name || ""} ${request.patient_last_name || ""}`.trim() || "-"}
                  </div>
                  <div><span className="font-semibold">Client DOB:</span> {request.patient_dob || "-"}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Transaction History</h2>
                {transaction ? (
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <div><span className="font-semibold">Linked Availity Transaction ID:</span> {transaction.id}</div>
                    <div><span className="font-semibold">Transaction Type:</span> {transaction.transaction_type}</div>
                    <div><span className="font-semibold">Transaction Status:</span> {transaction.status}</div>
                    <div><span className="font-semibold">Environment:</span> {transaction.environment}</div>
                    <div><span className="font-semibold">Started:</span> {transaction.started_at || "-"}</div>
                    <div><span className="font-semibold">Completed:</span> {transaction.completed_at || "-"}</div>
                    <div><span className="font-semibold">Request URL:</span> {transaction.request_url || "-"}</div>
                    <div><span className="font-semibold">Response Status:</span> {transaction.response_status ?? "-"}</div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">No linked transaction found.</div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Safe Payload Viewer</h2>
                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                    View request_payload_safe and response_payload_safe
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">request_payload_safe</h3>
                      <pre className="mt-2 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(request.request_payload_safe ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">response_payload_safe</h3>
                      <pre className="mt-2 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                        {JSON.stringify(request.response_payload_safe ?? {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
