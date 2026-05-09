"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

type EligibilityHistoryRow = {
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
};

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000";

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

export default function EligibilityHistoryPage() {
  const [organizationId, setOrganizationId] = useState(DEFAULT_ORG_ID);
  const [payerNameFilter, setPayerNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eligibilityStatusFilter, setEligibilityStatusFilter] = useState("");
  const [rows, setRows] = useState<EligibilityHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).sort();
  }, [rows]);

  const eligibilityStatusOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r.eligibility_status).filter(Boolean) as string[])
    ).sort();
  }, [rows]);

  const load = async () => {
    if (!organizationId.trim()) {
      setRows([]);
      setError("organization_id is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        organization_id: organizationId.trim(),
        limit: "50",
      });

      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (eligibilityStatusFilter) {
        params.set("eligibility_status", eligibilityStatusFilter);
      }

      const resp = await fetch(`/api/eligibility/requests?${params.toString()}`);
      const data = await resp.json();

      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load eligibility history");
      }

      const fetched = (data.requests ?? []) as EligibilityHistoryRow[];
      setRows(fetched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load eligibility history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredByPayer = useMemo(() => {
    const q = payerNameFilter.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => (row.payer_name || "").toLowerCase().includes(q));
  }, [rows, payerNameFilter]);

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/insurance/payers" className="hover:text-slate-700">Payers</Link>
            <span>/</span>
            <span className="font-semibold text-slate-700">Eligibility History</span>
          </div>

          <h1 className="text-3xl font-black text-slate-950">Eligibility History</h1>
          <p className="mt-2 text-sm text-slate-600">
            Review prepared eligibility requests and mock coverage summaries.
          </p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">Organization ID</label>
              <input
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">Payer Name</label>
              <input
                value={payerNameFilter}
                onChange={(e) => setPayerNameFilter(e.target.value)}
                placeholder="Search payer"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600">Eligibility Status</label>
              <select
                value={eligibilityStatusFilter}
                onChange={(e) => setEligibilityStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All</option>
                {eligibilityStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {error}
            </div>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="p-6 text-sm text-slate-600">Loading eligibility history...</div>
            ) : filteredByPayer.length === 0 ? (
              <div className="p-6 text-sm text-slate-600">No eligibility requests found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Created</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Payer</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Subscriber</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Patient</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Service Type</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Eligibility</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Copay</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Deductible Remaining</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Effective</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Termination</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">Mode</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByPayer.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{row.payer_name || "-"}</div>
                        <div className="text-xs text-slate-500">{row.payer_id || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {`${row.subscriber_first_name || ""} ${row.subscriber_last_name || ""}`.trim() || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {`${row.patient_first_name || ""} ${row.patient_last_name || ""}`.trim() || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.service_type_code} {row.service_type_description}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.eligibility_status || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.copay_amount)}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.deductible_remaining)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.effective_date || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.termination_date || "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{row.request_mode}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/eligibility/requests/${row.id}`} className="text-xs font-bold text-indigo-700 hover:text-indigo-900">
                          View Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
