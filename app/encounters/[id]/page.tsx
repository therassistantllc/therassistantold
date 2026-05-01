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
  const [creatingClaim, setCreatingClaim] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [existingClaimId, setExistingClaimId] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId) return;

    let active = true;

    async function loadEncounterDetail() {
      setLoading(true);
      setError(null);

      const [{ data: encounterData, error: encounterError }, { data: diagnosesData }, { data: serviceLinesData }, { data: existingClaim }] =
        await Promise.all([
          supabase.from("encounters").select("*").eq("id", encounterId).is("archived_at", null).single(),
          supabase.from("encounter_diagnoses").select("*").eq("encounter_id", encounterId).is("archived_at", null),
          supabase.from("encounter_service_lines").select("*").eq("encounter_id", encounterId).is("archived_at", null),
          supabase.from("claims").select("id").eq("encounter_id", encounterId).is("archived_at", null).maybeSingle(),
        ]);

      if (!active) return;

      if (encounterError) {
        setError(encounterError.message);
        setEncounter(null);
        setDiagnoses([]);
        setServiceLines([]);
        setExistingClaimId(null);
        setLoading(false);
        return;
      }

      setEncounter(encounterData as EncounterRecord);
      setDiagnoses((diagnosesData ?? []) as DiagnosisRecord[]);
      setServiceLines((serviceLinesData ?? []) as ServiceLineRecord[]);
      setExistingClaimId(existingClaim?.id || null);
      setLoading(false);
    }

    void loadEncounterDetail();

    return () => {
      active = false;
    };
  }, [encounterId]);

  async function handleCreateClaim() {
    if (!encounterId) return;

    setCreatingClaim(true);
    setClaimMessage(null);

    try {
      const response = await fetch("/api/claims/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounterId,
          organizationId: encounter?.organization_id,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setClaimMessage({ type: "success", text: result.message });
        setExistingClaimId(result.claim.id);
      } else {
        setClaimMessage({ type: "error", text: result.error || "Failed to create claim" });
      }
    } catch (error) {
      setClaimMessage({ type: "error", text: "Network error" });
    } finally {
      setCreatingClaim(false);
      setTimeout(() => setClaimMessage(null), 5000);
    }
  }

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

              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-blue-900">Billing Actions</h2>
                
                {existingClaimId ? (
                  <div className="space-y-3">
                    <p className="text-sm text-green-800">
                      ✓ Claim created for this encounter
                    </p>
                    <Link
                      href={`/claims/${existingClaimId}`}
                      className="inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      View Claim
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-blue-800">
                      This encounter is ready for billing. Create a claim to submit to the clearinghouse.
                    </p>
                    <button
                      onClick={() => void handleCreateClaim()}
                      disabled={creatingClaim}
                      className="rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingClaim ? "Creating..." : "Create Claim"}
                    </button>
                  </div>
                )}

                {claimMessage && (
                  <div className={`mt-3 rounded-lg px-4 py-2 text-sm ${claimMessage.type === "success" ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200"}`}>
                    {claimMessage.text}
                  </div>
                )}

                <div className="mt-4 text-xs text-blue-700">
                  <strong>Note:</strong> Creating a claim will generate an 837 transaction record and add it to the workqueue for submission.
                </div>
              </section>

              <div className="flex gap-3">
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
