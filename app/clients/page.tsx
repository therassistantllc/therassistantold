// File: app/clients/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClientRecord } from "@/lib/types";
import { useActiveContext } from "@/lib/store/activeContext";

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Global Active Context
  const { setContext } = useActiveContext();

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("clients")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as ClientRecord[]);
      setLoading(false);
    }

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").toLowerCase();
      return (
        query.length === 0 ||
        row.id.toLowerCase().includes(query) ||
        fullName.includes(query) ||
        (row.preferred_name ?? "").toLowerCase().includes(query) ||
        (row.email ?? "").toLowerCase().includes(query) ||
        (row.phone ?? "").toLowerCase().includes(query) ||
        (row.mrn ?? "").toLowerCase().includes(query)
      );
    });
  }, [rows, search]);

  function handlePatientClick(patient: ClientRecord) {
    const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || 
      patient.preferred_name || 
      `Patient ${patient.id.slice(0, 8)}`;
    
    setContext({
      patientId: patient.id,
      patientName,
      // Clear appointment/encounter context since we're selecting a new patient
      appointmentId: null,
      appointmentDate: null,
      encounterId: null,
      encounterStatus: null,
    });
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
              <p className="mt-2 text-sm text-gray-600">Client directory with direct chart access.</p>
            </div>
            <Link href="/clients/new" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
              New Client
            </Link>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone, MRN, or client id"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading clients...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load clients: {error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <div className="text-lg font-semibold text-gray-900">No clients yet</div>
              <div className="mt-2 text-sm text-gray-600">Start with a client record so scheduling, encounters, and charting can follow.</div>
              <Link href="/clients/new" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
                Create first client
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Preferred</th>
                      <th className="px-4 py-3">DOB</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">MRN</th>
                      <th className="px-4 py-3">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row) => (
                      <tr 
                        key={row.id} 
                        onClick={() => {
                          handlePatientClick(row);
                          window.location.href = `/patients/${row.id}`;
                        }}
                        className="cursor-pointer text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">{[row.first_name, row.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-4 py-3">{row.preferred_name ?? "—"}</td>
                        <td className="px-4 py-3">{row.date_of_birth ?? "—"}</td>
                        <td className="px-4 py-3">{row.phone ?? "—"}</td>
                        <td className="px-4 py-3">{row.email ?? "—"}</td>
                        <td className="px-4 py-3">{row.mrn ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Link 
                            href={`/patients/${row.id}`} 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePatientClick(row);
                            }}
                            className="text-blue-700 hover:underline"
                          >
                            Open Workspace
                          </Link>
                        </td>
                      </tr>
                    ))}
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
