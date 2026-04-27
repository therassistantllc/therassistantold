// File: app/encounters/diagnoses/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterDiagnosisRecord } from "@/lib/types";

export default function EncounterDiagnosesPage() {
  const [rows, setRows] = useState<EncounterDiagnosisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("encounter_diagnoses")
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

      setRows((data ?? []) as EncounterDiagnosisRecord[]);
      setLoading(false);
    }

    void loadRows();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) =>
      query.length === 0 ||
      row.id.toLowerCase().includes(query) ||
      (row.encounter_id ?? "").toLowerCase().includes(query) ||
      (row.diagnosis_code ?? "").toLowerCase().includes(query) ||
      (row.diagnosis_description ?? "").toLowerCase().includes(query)
    );
  }, [rows, search]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Encounter Diagnoses</h1>
              <p className="mt-2 text-sm text-gray-600">Diagnosis coding linked to encounters.</p>
            </div>
            <Link href="/encounters/diagnoses/new" className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
              New Diagnosis
            </Link>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by encounter, code, description, or diagnosis id"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading diagnoses...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load diagnoses: {error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
              <div className="text-lg font-semibold text-gray-900">No diagnoses yet</div>
              <div className="mt-2 text-sm text-gray-600">Add diagnosis records so service lines and claims can be supported.</div>
              <Link href="/encounters/diagnoses/new" className="mt-5 inline-block rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
                Add first diagnosis
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Encounter</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Primary</th>
                      <th className="px-4 py-3">Sequence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="text-sm text-gray-700">
                        <td className="px-4 py-3 font-mono text-xs">{row.encounter_id ?? "—"}</td>
                        <td className="px-4 py-3">{row.diagnosis_code ?? "—"}</td>
                        <td className="px-4 py-3">{row.diagnosis_description ?? "—"}</td>
                        <td className="px-4 py-3">{row.is_primary ? "Yes" : "No"}</td>
                        <td className="px-4 py-3">{row.sequence_number ?? "—"}</td>
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
