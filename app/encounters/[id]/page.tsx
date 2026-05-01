"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface EncounterRecord {
  id: string;
  client_id?: string | null;
  provider_id?: string | null;
  appointment_id?: string | null;
  encounter_status?: string | null;
  service_date?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  chief_complaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  clinical_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface DiagnosisRecord {
  id: string;
  icd_10_code?: string | null;
  description?: string | null;
  is_primary?: boolean | null;
}

interface ServiceLineRecord {
  id: string;
  cpt_hcpcs_code?: string | null;
  description?: string | null;
  units?: number | null;
  charge_amount?: string | null;
  place_of_service_code?: string | null;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function EncounterDetailPage() {
  const params = useParams<{ id: string }>();
  const encounterId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [encounter, setEncounter] = useState<EncounterRecord | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [serviceLines, setServiceLines] = useState<ServiceLineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId) return;

    let active = true;

    async function loadEncounterDetail() {
      setLoading(true);
      setError(null);

      const [{ data: encounterData, error: encounterError }, { data: diagnosesData }, { data: serviceLinesData }] =
        await Promise.all([
          supabase.from("encounters").select("*").eq("id", encounterId).is("archived_at", null).single(),
          supabase.from("encounter_diagnoses").select("*").eq("encounter_id", encounterId).is("archived_at", null),
          supabase.from("encounter_service_lines").select("*").eq("encounter_id", encounterId).is("archived_at", null),
        ]);

      if (!active) return;

      if (encounterError) {
        setError(encounterError.message);
        setEncounter(null);
        setDiagnoses([]);
        setServiceLines([]);
        setLoading(false);
        return;
      }

      setEncounter(encounterData as EncounterRecord);
      setDiagnoses((diagnosesData ?? []) as DiagnosisRecord[]);
      setServiceLines((serviceLinesData ?? []) as ServiceLineRecord[]);
      setLoading(false);
    }

    void loadEncounterDetail();

    return () => {
      active = false;
    };
  }, [encounterId]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Encounter Detail</h1>
            <p className="mt-2 text-sm text-gray-600">
              Clinical documentation and encounter information.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading encounter detail...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load encounter: {error}
            </div>
          ) : !encounter ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Encounter not found.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Encounter ID</div>
                    <div className="mt-1 break-all font-mono text-sm text-gray-900">{encounter.id}</div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <div className="mt-1 text-lg font-semibold text-gray-900">{encounter.encounter_status ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Service date</div>
                      <div className="mt-1 text-sm text-gray-900">{formatDate(encounter.service_date)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Client</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-900">
                        {encounter.client_id ? (
                          <Link href={`/patients/${encounter.client_id}`} className="text-blue-600 hover:underline">
                            {encounter.client_id}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Provider</div>
                      <div className="mt-1 break-all font-mono text-xs text-gray-900">{encounter.provider_id ?? "—"}</div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Chief Complaint</h2>
                  <p className="text-sm text-gray-700">{encounter.chief_complaint || "—"}</p>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Session Info</h2>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Started</dt>
                      <dd className="text-gray-900">{formatDateTime(encounter.started_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Ended</dt>
                      <dd className="text-gray-900">{formatDateTime(encounter.ended_at)}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">SOAP Notes</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Subjective</h3>
                    <p className="text-sm text-gray-600">{encounter.subjective || "—"}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Objective</h3>
                    <p className="text-sm text-gray-600">{encounter.objective || "—"}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Assessment</h3>
                    <p className="text-sm text-gray-600">{encounter.assessment || "—"}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Plan</h3>
                    <p className="text-sm text-gray-600">{encounter.plan || "—"}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Diagnoses ({diagnoses.length})</h2>
                {diagnoses.length === 0 ? (
                  <p className="text-sm text-gray-500">No diagnoses recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">ICD-10</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Primary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {diagnoses.map((diagnosis) => (
                          <tr key={diagnosis.id} className="text-sm">
                            <td className="px-4 py-3 font-mono">{diagnosis.icd_10_code || "—"}</td>
                            <td className="px-4 py-3">{diagnosis.description || "—"}</td>
                            <td className="px-4 py-3">{diagnosis.is_primary ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Service Lines ({serviceLines.length})</h2>
                {serviceLines.length === 0 ? (
                  <p className="text-sm text-gray-500">No service lines recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">CPT/HCPCS</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Units</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Charge</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">POS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {serviceLines.map((line) => (
                          <tr key={line.id} className="text-sm">
                            <td className="px-4 py-3 font-mono">{line.cpt_hcpcs_code || "—"}</td>
                            <td className="px-4 py-3">{line.description || "—"}</td>
                            <td className="px-4 py-3">{line.units ?? "—"}</td>
                            <td className="px-4 py-3">{line.charge_amount || "—"}</td>
                            <td className="px-4 py-3">{line.place_of_service_code || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!encounterId) return;
                    try {
                      const response = await fetch("/api/claims/create-from-encounter", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ encounterId }),
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.claim?.id) {
                          window.location.href = `/claims/${data.claim.id}`;
                        } else {
                          alert("Claim created successfully");
                        }
                      } else {
                        const error = await response.json();
                        alert(`Failed to create claim: ${error.error || "Unknown error"}`);
                      }
                    } catch (error) {
                      console.error("Failed to create claim:", error);
                      alert("Failed to create claim");
                    }
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create Claim
                </button>
                <Link
                  href={encounter.client_id ? `/patients/${encounter.client_id}` : "/patients"}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Back to Patient
                </Link>
                <Link
                  href="/encounters"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  All Encounters
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
