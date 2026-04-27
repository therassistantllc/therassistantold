// File: app/encounters/service-lines/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterServiceLineRecord } from "@/lib/types";

export default function EncounterServiceLinesPage() {
  const [rows, setRows] = useState<EncounterServiceLineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("encounter_service_lines")
        .select("*")
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(200);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as EncounterServiceLineRecord[]);
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
      (row.cpt_hcpcs_code ?? "").toLowerCase().includes(query) ||
      (row.place_of_service_code ?? "").toLowerCase().includes(query) ||
      (row.rendering_provider_id ?? "").toLowerCase().includes(query)
    );
  }, [rows, search]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Encounter Service Lines</h1>
            <p className="mt-2 text-sm text-gray-600">Aligned to your real encounter_service_lines schema.</p>
          </div>

          <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by encounter, CPT/HCPCS, POS, rendering provider, or line id"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading encounter service lines...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load encounter service lines: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Encounter</th>
                      <th className="px-4 py-3">Seq</th>
                      <th className="px-4 py-3">Service date</th>
                      <th className="px-4 py-3">CPT/HCPCS</th>
                      <th className="px-4 py-3">Units</th>
                      <th className="px-4 py-3">Charge</th>
                      <th className="px-4 py-3">POS</th>
                      <th className="px-4 py-3">Rendering provider</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No service lines found.</td></tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3 font-mono text-xs">{row.encounter_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.sequence_number ?? "—"}</td>
                          <td className="px-4 py-3">{row.service_date ?? "—"}</td>
                          <td className="px-4 py-3">{row.cpt_hcpcs_code ?? "—"}</td>
                          <td className="px-4 py-3">{row.units ?? "—"}</td>
                          <td className="px-4 py-3">{row.charge_amount ?? "—"}</td>
                          <td className="px-4 py-3">{row.place_of_service_code ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.rendering_provider_id ?? "—"}</td>
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
