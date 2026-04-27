// File: app/encounters/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterRecord } from "@/lib/types";

type EncounterStatusFilter = "all" | "scheduled" | "in_progress" | "ready_for_billing" | "completed" | "signed";

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

function matchesStatus(encounter: EncounterRecord, filter: EncounterStatusFilter) {
  if (filter === "all") return true;
  return (encounter.encounter_status ?? "") === filter;
}

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EncounterStatusFilter>("all");

  useEffect(() => {
    let active = true;

    async function loadEncounters() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("encounters")
        .select("*")
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(100);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setEncounters([]);
        setLoading(false);
        return;
      }

      setEncounters((data ?? []) as EncounterRecord[]);
      setLoading(false);
    }

    void loadEncounters();

    return () => {
      active = false;
    };
  }, []);

  const filteredEncounters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return encounters.filter((encounter) => {
      const matchesQuery =
        query.length === 0 ||
        encounter.id.toLowerCase().includes(query) ||
        (encounter.client_id ?? "").toLowerCase().includes(query) ||
        (encounter.provider_id ?? "").toLowerCase().includes(query) ||
        (encounter.encounter_status ?? "").toLowerCase().includes(query) ||
        (encounter.appointment_id ?? "").toLowerCase().includes(query);

      return matchesQuery && matchesStatus(encounter, statusFilter);
    });
  }, [encounters, search, statusFilter]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Encounters</h1>
            <p className="mt-2 text-sm text-gray-600">
              Live encounters from Supabase using your real encounter schema.
            </p>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">Total loaded</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{encounters.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Filtered</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{filteredEncounters.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Completed</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {encounters.filter((item) => item.encounter_status === "completed").length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Billing fields complete</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {encounters.filter((item) => item.required_billing_fields_complete).length}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by encounter id, client, provider, appointment, or status"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as EncounterStatusFilter)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            >
              <option value="all">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="ready_for_billing">Ready for billing</option>
              <option value="completed">Completed</option>
              <option value="signed">Signed</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading encounters...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load encounters: {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Service date</th>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Ended</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Appointment</th>
                      <th className="px-4 py-3">Billing complete</th>
                      <th className="px-4 py-3">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEncounters.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                          No encounters found.
                        </td>
                      </tr>
                    ) : (
                      filteredEncounters.map((encounter) => (
                        <tr key={encounter.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{encounter.service_date ?? "—"}</td>
                          <td className="px-4 py-3">{formatDateTime(encounter.started_at)}</td>
                          <td className="px-4 py-3">{formatDateTime(encounter.ended_at)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {encounter.encounter_status ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{encounter.client_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{encounter.provider_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{encounter.appointment_id ?? "—"}</td>
                          <td className="px-4 py-3">
                            {encounter.required_billing_fields_complete ? "Yes" : "No"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href="/encounters/diagnoses" className="text-blue-700 hover:underline">
                                Diagnoses
                              </Link>
                              <Link href="/encounters/service-lines" className="text-blue-700 hover:underline">
                                Service Lines
                              </Link>
                              <Link href="/claims/create" className="text-blue-700 hover:underline">
                                Create Claim
                              </Link>
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
