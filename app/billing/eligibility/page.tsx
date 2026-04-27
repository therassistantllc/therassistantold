// File: app/billing/eligibility/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClientRecord, EligibilityCheckRecord, InsurancePolicyRecord } from "@/lib/types";

type EligibilityFilter = "all" | "eligible" | "ineligible" | "needs_review";

interface EligibilityQueueRow extends EligibilityCheckRecord {
  client?: ClientRecord | null;
  policy?: InsurancePolicyRecord | null;
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

function normalizeStatus(row: EligibilityQueueRow) {
  return String(row.eligibility_status ?? row.raw_status_text ?? "").toLowerCase();
}

function matchesFilter(row: EligibilityQueueRow, filter: EligibilityFilter) {
  if (filter === "all") return true;
  const status = normalizeStatus(row);
  if (filter === "eligible") return status.includes("eligible") || status.includes("active") || status.includes("verified");
  if (filter === "ineligible") return status.includes("ineligible") || status.includes("inactive");
  return status.includes("review") || status.includes("warning") || status.includes("manual") || status.includes("unknown");
}

export default function EligibilityQueuePage() {
  const [rows, setRows] = useState<EligibilityQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EligibilityFilter>("all");

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: eligibilityData, error: eligibilityError } = await supabase
        .from("eligibility_checks")
        .select("*")
        .is("archived_at", null)
        .order("checked_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (eligibilityError) {
        setError(eligibilityError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const checks = (eligibilityData ?? []) as EligibilityCheckRecord[];
      const clientIds = Array.from(new Set(checks.map((item) => item.client_id).filter(Boolean))) as string[];
      const policyIds = Array.from(new Set(checks.map((item) => item.insurance_policy_id).filter(Boolean))) as string[];

      let clientsById = new Map<string, ClientRecord>();
      let policiesById = new Map<string, InsurancePolicyRecord>();

      if (clientIds.length > 0) {
        const { data, error } = await supabase.from("clients").select("*").in("id", clientIds);
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        clientsById = new Map(((data ?? []) as ClientRecord[]).map((item) => [item.id, item]));
      }

      if (policyIds.length > 0) {
        const { data, error } = await supabase.from("insurance_policies").select("*").in("id", policyIds);
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        policiesById = new Map(((data ?? []) as InsurancePolicyRecord[]).map((item) => [item.id, item]));
      }

      setRows(
        checks.map((item) => ({
          ...item,
          client: item.client_id ? clientsById.get(item.client_id) ?? null : null,
          policy: item.insurance_policy_id ? policiesById.get(item.insurance_policy_id) ?? null : null,
        }))
      );
      setLoading(false);
    }

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const clientName = [row.client?.first_name, row.client?.last_name].filter(Boolean).join(" ").toLowerCase();
      const policyNumber = (row.policy?.policy_number ?? "").toLowerCase();
      const status = normalizeStatus(row);
      const matchesQuery =
        query.length === 0 ||
        row.id.toLowerCase().includes(query) ||
        (row.client_id ?? "").toLowerCase().includes(query) ||
        (row.insurance_policy_id ?? "").toLowerCase().includes(query) ||
        (row.external_transaction_id ?? "").toLowerCase().includes(query) ||
        (row.response_summary ?? "").toLowerCase().includes(query) ||
        clientName.includes(query) ||
        policyNumber.includes(query) ||
        status.includes(query);
      return matchesQuery && matchesFilter(row, statusFilter);
    });
  }, [rows, search, statusFilter]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Eligibility Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Aligned to your real eligibility_checks schema.</p>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by patient, policy number, transaction id, response summary, or status"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as EligibilityFilter)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            >
              <option value="all">All statuses</option>
              <option value="eligible">Eligible</option>
              <option value="ineligible">Ineligible</option>
              <option value="needs_review">Needs review</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading eligibility queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load eligibility queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Checked</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Policy number</th>
                      <th className="px-4 py-3">Copay</th>
                      <th className="px-4 py-3">Deductible remaining</th>
                      <th className="px-4 py-3">Transaction</th>
                      <th className="px-4 py-3">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No eligibility items found.</td></tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.checked_at ?? row.created_at)}</td>
                          <td className="px-4 py-3">{row.eligibility_status ?? row.raw_status_text ?? "—"}</td>
                          <td className="px-4 py-3">{[row.client?.first_name, row.client?.last_name].filter(Boolean).join(" ") || "—"}</td>
                          <td className="px-4 py-3">{row.policy?.policy_number ?? "—"}</td>
                          <td className="px-4 py-3">{row.copay_amount ?? "—"}</td>
                          <td className="px-4 py-3">{row.deductible_remaining ?? "—"}</td>
                          <td className="px-4 py-3">{row.external_transaction_id ?? "—"}</td>
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
