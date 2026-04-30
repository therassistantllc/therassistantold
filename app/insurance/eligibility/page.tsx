"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface EligibilityCheck {
  id: string;
  patient_id: string;
  policy_id?: string | null;
  status: "active" | "inactive" | "not_found" | "error" | "unknown";
  copay_amount?: number | null;
  deductible_remaining?: number | null;
  checked_at?: string | null;
  payer_name?: string | null;
  plan_name?: string | null;
  member_id?: string | null;
  error_message?: string | null;
}

interface PatientRow {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  mrn?: string | null;
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

function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "not_found":
      return "bg-yellow-100 text-yellow-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function InsuranceEligibilityPage() {
  const [checks, setChecks] = useState<(EligibilityCheck & { patient?: PatientRow })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEligibilityChecks() {
      setLoading(true);
      setError(null);

      const { data: checksData, error: checksError } = await supabase
        .from("eligibility_checks")
        .select("*")
        .is("archived_at", null)
        .order("checked_at", { ascending: false })
        .limit(200);

      if (!active) return;

      if (checksError) {
        setError(checksError.message);
        setChecks([]);
        setLoading(false);
        return;
      }

      const checks = (checksData ?? []) as EligibilityCheck[];
      const patientIds = Array.from(new Set(checks.map((c) => c.patient_id)));

      if (patientIds.length > 0) {
        const { data: patientsData } = await supabase
          .from("clients")
          .select("id, first_name, last_name, mrn")
          .in("id", patientIds);

        const patientById = new Map((patientsData ?? []).map((p: PatientRow) => [p.id, p]));

        setChecks(checks.map((check) => ({ ...check, patient: patientById.get(check.patient_id) })));
      } else {
        setChecks(checks);
      }

      setLoading(false);
    }

    void loadEligibilityChecks();

    return () => {
      active = false;
    };
  }, []);

  const filteredChecks = checks.filter((check) => {
    const matchesStatus = statusFilter === "all" || check.status === statusFilter;
    const query = search.trim().toLowerCase();
    const patientName = [check.patient?.first_name, check.patient?.last_name].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      patientName.includes(query) ||
      (check.patient?.mrn ?? "").toLowerCase().includes(query) ||
      (check.payer_name ?? "").toLowerCase().includes(query) ||
      (check.plan_name ?? "").toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: checks.length,
    active: checks.filter((c) => c.status === "active").length,
    inactive: checks.filter((c) => c.status === "inactive").length,
    not_found: checks.filter((c) => c.status === "not_found").length,
    error: checks.filter((c) => c.status === "error").length,
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Insurance Eligibility</h1>
            <p className="mt-2 text-sm text-gray-600">
              View and manage insurance eligibility verification checks for patients.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading eligibility checks...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Error loading eligibility checks: {error}
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Total Checks</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{statusCounts.all}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Active</div>
                  <div className="mt-2 text-2xl font-semibold text-green-600">{statusCounts.active}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Inactive</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-600">{statusCounts.inactive}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Not Found</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-600">{statusCounts.not_found}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Errors</div>
                  <div className="mt-2 text-2xl font-semibold text-red-600">{statusCounts.error}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["all", "active", "inactive", "not_found", "error"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={[
                          "rounded-lg px-3 py-2 text-sm capitalize",
                          statusFilter === status
                            ? "bg-blue-50 text-blue-700"
                            : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Search patients, payers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Patient</th>
                        <th className="px-4 py-3">Payer</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Member ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Copay</th>
                        <th className="px-4 py-3">Deductible Remaining</th>
                        <th className="px-4 py-3">Checked</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredChecks.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                            {search || statusFilter !== "all"
                              ? "No eligibility checks match your filters."
                              : "No eligibility checks found."}
                          </td>
                        </tr>
                      ) : (
                        filteredChecks.map((check) => (
                          <tr key={check.id} className="text-sm text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <Link href={`/patients/${check.patient_id}`} className="text-blue-600 hover:underline">
                                {check.patient
                                  ? [check.patient.first_name, check.patient.last_name].filter(Boolean).join(" ")
                                  : check.patient_id.slice(0, 8)}
                              </Link>
                              {check.patient?.mrn && <div className="text-xs text-gray-500">MRN: {check.patient.mrn}</div>}
                            </td>
                            <td className="px-4 py-3">{check.payer_name || "—"}</td>
                            <td className="px-4 py-3">{check.plan_name || "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs">{check.member_id || "—"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                                  check.status
                                )}`}
                              >
                                {check.status?.replace("_", " ") || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{check.copay_amount ? `$${check.copay_amount}` : "—"}</td>
                            <td className="px-4 py-3">
                              {check.deductible_remaining ? `$${check.deductible_remaining}` : "—"}
                            </td>
                            <td className="px-4 py-3">{formatDateTime(check.checked_at)}</td>
                            <td className="px-4 py-3">
                              <button className="text-blue-600 hover:underline" disabled>
                                Re-check
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
