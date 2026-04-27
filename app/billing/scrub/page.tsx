// File: app/billing/scrub/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterDiagnosisRecord, EncounterRecord, EncounterServiceLineRecord } from "@/lib/types";

interface ScrubRow extends EncounterRecord {
  diagnoses: EncounterDiagnosisRecord[];
  serviceLines: EncounterServiceLineRecord[];
  scrubIssues: string[];
}

export default function ClaimScrubQueuePage() {
  const [rows, setRows] = useState<ScrubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: encounterData, error: encounterError } = await supabase
        .from("encounters")
        .select("*")
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(100);

      if (!active) return;
      if (encounterError) {
        setError(encounterError.message);
        setLoading(false);
        return;
      }

      const encounters = (encounterData ?? []) as EncounterRecord[];
      const encounterIds = encounters.map((item) => item.id);

      const [diagnosisResp, serviceLineResp] = await Promise.all([
        supabase.from("encounter_diagnoses").select("*").in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"]).is("archived_at", null),
        supabase.from("encounter_service_lines").select("*").in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"]).is("archived_at", null),
      ]);

      if (!active) return;
      if (diagnosisResp.error || serviceLineResp.error) {
        setError(diagnosisResp.error?.message || serviceLineResp.error?.message || "Could not load scrub prerequisites.");
        setLoading(false);
        return;
      }

      const diagnosisMap = new Map<string, EncounterDiagnosisRecord[]>();
      for (const item of ((diagnosisResp.data ?? []) as EncounterDiagnosisRecord[])) {
        const key = item.encounter_id ?? "";
        diagnosisMap.set(key, [...(diagnosisMap.get(key) ?? []), item]);
      }

      const serviceLineMap = new Map<string, EncounterServiceLineRecord[]>();
      for (const item of ((serviceLineResp.data ?? []) as EncounterServiceLineRecord[])) {
        const key = item.encounter_id ?? "";
        serviceLineMap.set(key, [...(serviceLineMap.get(key) ?? []), item]);
      }

      const merged = encounters.map((encounter) => {
        const diagnoses = diagnosisMap.get(encounter.id) ?? [];
        const serviceLines = serviceLineMap.get(encounter.id) ?? [];
        const issues: string[] = [];

        if (!encounter.required_billing_fields_complete) issues.push("Missing required billing fields");
        if (diagnoses.length === 0) issues.push("No diagnoses attached");
        if (!diagnoses.some((item) => item.is_primary)) issues.push("Primary diagnosis missing");
        if (serviceLines.length === 0) issues.push("No encounter service lines");
        if (serviceLines.some((item) => !item.cpt_hcpcs_code)) issues.push("Missing CPT/HCPCS");
        if (serviceLines.some((item) => !item.place_of_service_code)) issues.push("Missing place of service");
        if (serviceLines.some((item) => !item.ready_for_claim)) issues.push("Service line not ready for claim");

        return {
          ...encounter,
          diagnoses,
          serviceLines,
          scrubIssues: issues,
        };
      }).filter((item) => item.scrubIssues.length > 0);

      setRows(merged);
      setLoading(false);
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Claim Scrub Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Pre-submission issues that should be fixed before a claim is created or sent.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading scrub queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load scrub queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Service date</th>
                      <th className="px-4 py-3">Encounter</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Issues</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No scrub exceptions found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{row.service_date ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                          <td className="px-4 py-3 font-mono text-xs">{row.client_id ?? "—"}</td>
                          <td className="px-4 py-3">{row.scrubIssues.join(", ")}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href="/encounters" className="text-blue-700 hover:underline">Encounter</Link>
                              <Link href="/encounters/diagnoses" className="text-blue-700 hover:underline">Diagnoses</Link>
                              <Link href="/encounters/service-lines" className="text-blue-700 hover:underline">Service Lines</Link>
                              <Link href="/claims/create" className="text-blue-700 hover:underline">Create Claim</Link>
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
