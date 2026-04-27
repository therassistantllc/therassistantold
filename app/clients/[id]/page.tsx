// File: app/clients/[id]/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type {
  AppointmentRecord,
  ClaimRecord,
  ClientRecord,
  EncounterDiagnosisRecord,
  EncounterRecord,
  EncounterServiceLineRecord,
  InsurancePolicyRecord,
} from "@/lib/types";

interface EncounterNoteDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  riskNotes: string;
  sessionSummary: string;
}

interface EncounterChartRow extends EncounterRecord {
  diagnoses: EncounterDiagnosisRecord[];
  serviceLines: EncounterServiceLineRecord[];
  appointment?: AppointmentRecord | null;
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

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

function buildSoapNote(draft: EncounterNoteDraft) {
  return {
    subjective: draft.subjective || null,
    objective: draft.objective || null,
    assessment: draft.assessment || null,
    plan: draft.plan || null,
    risk_notes: draft.riskNotes || null,
  };
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ClientChartPage() {
  const params = useParams<{ id: string }>();
  const clientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [encounters, setEncounters] = useState<EncounterChartRow[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [activeEncounterId, setActiveEncounterId] = useState("");
  const [noteDraft, setNoteDraft] = useState<EncounterNoteDraft>({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    riskNotes: "",
    sessionSummary: "",
  });
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [signingNote, setSigningNote] = useState(false);
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [creatingClaim, setCreatingClaim] = useState(false);

  async function loadChart() {
    if (!clientId) {
      setError("Client ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [clientResp, appointmentResp, encounterResp, policyResp, claimResp] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("appointments").select("*").eq("client_id", clientId).is("archived_at", null).order("scheduled_start_at", { ascending: false }).limit(100),
      supabase.from("encounters").select("*").eq("client_id", clientId).is("archived_at", null).order("service_date", { ascending: false }).limit(100),
      supabase.from("insurance_policies").select("*").eq("client_id", clientId).is("archived_at", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("claims").select("*").eq("client_id", clientId).is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    ]);

    const firstError =
      clientResp.error?.message ||
      appointmentResp.error?.message ||
      encounterResp.error?.message ||
      policyResp.error?.message ||
      claimResp.error?.message;

    if (firstError) {
      setError(firstError);
      setLoading(false);
      return;
    }

    const appointmentRows = (appointmentResp.data ?? []) as AppointmentRecord[];
    const encounterRows = (encounterResp.data ?? []) as EncounterRecord[];
    const encounterIds = encounterRows.map((row) => row.id);
    const appointmentById = new Map(appointmentRows.map((row) => [row.id, row]));

    const [diagnosisResp, serviceLineResp] = await Promise.all([
      supabase
        .from("encounter_diagnoses")
        .select("*")
        .in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"])
        .is("archived_at", null),
      supabase
        .from("encounter_service_lines")
        .select("*")
        .in("encounter_id", encounterIds.length ? encounterIds : ["00000000-0000-0000-0000-000000000000"])
        .is("archived_at", null),
    ]);

    const detailError = diagnosisResp.error?.message || serviceLineResp.error?.message;
    if (detailError) {
      setError(detailError);
      setLoading(false);
      return;
    }

    const diagnoses = (diagnosisResp.data ?? []) as EncounterDiagnosisRecord[];
    const serviceLines = (serviceLineResp.data ?? []) as EncounterServiceLineRecord[];

    const diagnosesByEncounter = new Map<string, EncounterDiagnosisRecord[]>();
    for (const item of diagnoses) {
      const key = item.encounter_id ?? "";
      diagnosesByEncounter.set(key, [...(diagnosesByEncounter.get(key) ?? []), item]);
    }

    const serviceLinesByEncounter = new Map<string, EncounterServiceLineRecord[]>();
    for (const item of serviceLines) {
      const key = item.encounter_id ?? "";
      serviceLinesByEncounter.set(key, [...(serviceLinesByEncounter.get(key) ?? []), item]);
    }

    const mergedEncounters: EncounterChartRow[] = encounterRows.map((row) => ({
      ...row,
      diagnoses: diagnosesByEncounter.get(row.id) ?? [],
      serviceLines: serviceLinesByEncounter.get(row.id) ?? [],
      appointment: row.appointment_id ? appointmentById.get(row.appointment_id) ?? null : null,
    }));

    setClient(clientResp.data as ClientRecord);
    setAppointments(appointmentRows);
    setEncounters(mergedEncounters);
    setPolicies((policyResp.data ?? []) as InsurancePolicyRecord[]);
    setClaims((claimResp.data ?? []) as ClaimRecord[]);
    setLoading(false);

    if (!selectedAppointmentId && appointmentRows.length > 0) {
      setSelectedAppointmentId(appointmentRows[0].id);
    }
  }

  useEffect(() => {
    void loadChart();
  }, [clientId]);

  const chartTitle = useMemo(() => {
    if (!client) return "Client Chart";
    return [client.first_name, client.last_name].filter(Boolean).join(" ") || "Client Chart";
  }, [client]);

  const primaryPolicy = useMemo(
    () => policies.find((policy) => String(policy.priority) === "1") ?? policies[0] ?? null,
    [policies]
  );

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId]
  );

  const appointmentEncounter = useMemo(
    () => encounters.find((item) => item.appointment_id === selectedAppointmentId) ?? null,
    [encounters, selectedAppointmentId]
  );

  const activeEncounter = useMemo(() => {
    if (activeEncounterId) {
      return encounters.find((item) => item.id === activeEncounterId) ?? null;
    }
    return appointmentEncounter;
  }, [encounters, activeEncounterId, appointmentEncounter]);

  useEffect(() => {
    if (appointmentEncounter) {
      setActiveEncounterId(appointmentEncounter.id);
    }
  }, [appointmentEncounter?.id]);

  async function handleCreateEncounterFromAppointment() {
    if (!selectedAppointment) {
      setWorkflowError("Select an appointment first.");
      return;
    }

    if (appointmentEncounter) {
      setWorkflowSuccess(`Encounter already exists for this appointment: ${appointmentEncounter.id}`);
      setActiveEncounterId(appointmentEncounter.id);
      return;
    }

    setWorkflowError(null);
    setWorkflowSuccess(null);

    const payload = {
      organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
      appointment_id: selectedAppointment.id,
      client_id: selectedAppointment.client_id ?? null,
      provider_id: selectedAppointment.provider_id ?? null,
      encounter_status: "in_progress",
      started_at: selectedAppointment.scheduled_start_at ?? null,
      ended_at: selectedAppointment.scheduled_end_at ?? null,
      service_date: selectedAppointment.scheduled_start_at
        ? new Date(selectedAppointment.scheduled_start_at).toISOString().slice(0, 10)
        : null,
      required_billing_fields_complete: false,
    };

    const { data, error: insertError } = await supabase
      .from("encounters")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setWorkflowError(insertError.message);
      return;
    }

    setWorkflowSuccess(`Encounter created from appointment: ${data.id}`);
    setActiveEncounterId(data.id);
    await loadChart();
  }

  async function handleSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeEncounter) {
      setWorkflowError("Create or select an encounter first.");
      return;
    }

    setSavingNote(true);
    setWorkflowError(null);
    setWorkflowSuccess(null);

    const payload = {
      session_summary: noteDraft.sessionSummary || null,
      soap_note: buildSoapNote(noteDraft),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("encounters")
      .update(payload)
      .eq("id", activeEncounter.id);

    if (updateError) {
      setWorkflowError(updateError.message);
      setSavingNote(false);
      return;
    }

    setWorkflowSuccess(`Note saved for encounter: ${activeEncounter.id}`);
    setSavingNote(false);
  }

  async function handleSignNote() {
    if (!activeEncounter) {
      setWorkflowError("No active encounter selected.");
      return;
    }

    setSigningNote(true);
    setWorkflowError(null);
    setWorkflowSuccess(null);

    const { error: updateError } = await supabase
      .from("encounters")
      .update({
        encounter_status: "completed",
        required_billing_fields_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeEncounter.id);

    if (updateError) {
      setWorkflowError(updateError.message);
      setSigningNote(false);
      return;
    }

    setWorkflowSuccess(`Note signed and encounter marked completed: ${activeEncounter.id}`);
    setSigningNote(false);
    await loadChart();
  }

  async function handleGenerateCharge() {
    if (!activeEncounter) {
      setWorkflowError("No active encounter selected.");
      return;
    }

    if ((activeEncounter.encounter_status ?? "").toLowerCase() !== "completed") {
      setWorkflowError("Complete and sign the encounter note before generating a charge.");
      return;
    }

    if (activeEncounter.serviceLines.length > 0) {
      setWorkflowSuccess("Charge already exists as service lines for this encounter.");
      return;
    }

    setGeneratingCharge(true);
    setWorkflowError(null);
    setWorkflowSuccess(null);

    const appointmentType = activeEncounter.appointment?.appointment_type ?? "";
    const pos = appointmentType === "Telehealth" ? "02" : "11";
    const cpt = activeEncounter.appointment?.reason === "Intake" ? "90791" : "90834";

    const { data, error: insertError } = await supabase
      .from("encounter_service_lines")
      .insert({
        organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
        encounter_id: activeEncounter.id,
        service_date: activeEncounter.service_date ?? null,
        sequence_number: 1,
        cpt_hcpcs_code: cpt,
        units: "1",
        charge_amount: activeEncounter.appointment?.reason === "Intake" ? "200.00" : "150.00",
        place_of_service_code: pos,
        rendering_provider_id: activeEncounter.provider_id ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      setWorkflowError(insertError.message);
      setGeneratingCharge(false);
      return;
    }

    setWorkflowSuccess(`Charge generated as service line: ${data.id}`);
    setGeneratingCharge(false);
    await loadChart();
  }

  async function handleCreateClaim() {
    if (!activeEncounter) {
      setWorkflowError("No active encounter selected.");
      return;
    }

    if (activeEncounter.serviceLines.length === 0) {
      setWorkflowError("Generate a charge before creating a claim.");
      return;
    }

    const existingClaim = claims.find((item) => item.encounter_id === activeEncounter.id);
    if (existingClaim) {
      setWorkflowSuccess(`Claim already exists for this encounter: ${existingClaim.id}`);
      return;
    }

    setCreatingClaim(true);
    setWorkflowError(null);
    setWorkflowSuccess(null);

    const totalCharge = activeEncounter.serviceLines.reduce((sum, item) => {
      const value = Number.parseFloat(String(item.charge_amount ?? "0"));
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0).toFixed(2);

    const { data, error: insertError } = await supabase
      .from("claims")
      .insert({
        organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
        encounter_id: activeEncounter.id,
        client_id: activeEncounter.client_id ?? null,
        insurance_policy_id: primaryPolicy?.id ?? null,
        claim_status: "draft",
        total_charge_amount: totalCharge,
      })
      .select("id")
      .single();

    if (insertError) {
      setWorkflowError(insertError.message);
      setCreatingClaim(false);
      return;
    }

    setWorkflowSuccess(`Claim created from charge: ${data.id}`);
    setCreatingClaim(false);
    await loadChart();
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading client chart...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load client chart: {error}
            </div>
          ) : !client ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
              Client not found.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <div className="text-sm text-gray-500">Workflow Spine</div>
                    <h1 className="mt-1 text-3xl font-bold text-gray-900">{chartTitle}</h1>
                    <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                      <div>DOB: {formatDate(client.date_of_birth)}</div>
                      <div>MRN: {client.mrn ?? "—"}</div>
                      <div>Phone: {client.phone ?? "—"}</div>
                      <div>Email: {client.email ?? "—"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Link href="/scheduling/new" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                      New Appointment
                    </Link>
                    <Link href="/insurance/policies/new" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                      New Policy
                    </Link>
                  </div>
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  <Section
                    title="1. Appointment → Encounter → Note → Charge → Claim"
                    description="One dependency chain, centered on the selected appointment."
                  >
                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Select appointment</label>
                        <select
                          value={selectedAppointmentId}
                          onChange={(e) => setSelectedAppointmentId(e.target.value)}
                          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                        >
                          <option value="">Select appointment</option>
                          {appointments.map((appointment) => (
                            <option key={appointment.id} value={appointment.id}>
                              {formatDateTime(appointment.scheduled_start_at)} • {appointment.appointment_type ?? "—"} • {appointment.reason ?? "—"} • {appointment.appointment_status ?? "—"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-5">
                        <button
                          type="button"
                          onClick={() => void handleCreateEncounterFromAppointment()}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm hover:bg-gray-50"
                        >
                          Create Encounter
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSignNote()}
                          disabled={!activeEncounter || signingNote}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {signingNote ? "Signing..." : "Sign Note"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleGenerateCharge()}
                          disabled={!activeEncounter || generatingCharge}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {generatingCharge ? "Generating..." : "Generate Charge"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCreateClaim()}
                          disabled={!activeEncounter || creatingClaim}
                          className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                          {creatingClaim ? "Creating..." : "Create Claim"}
                        </button>
                        <Link href="/claims/submissions" className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-sm hover:bg-gray-50">
                          Claim Queue
                        </Link>
                      </div>

                      {selectedAppointment ? (
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="text-sm font-medium text-blue-900">Appointment</div>
                            <div className="mt-2 text-sm text-blue-900">{formatDateTime(selectedAppointment.scheduled_start_at)}</div>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="text-sm font-medium text-blue-900">Type</div>
                            <div className="mt-2 text-sm text-blue-900">{selectedAppointment.appointment_type ?? "—"}</div>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="text-sm font-medium text-blue-900">Reason</div>
                            <div className="mt-2 text-sm text-blue-900">{selectedAppointment.reason ?? "—"}</div>
                          </div>
                          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                            <div className="text-sm font-medium text-blue-900">Encounter linked</div>
                            <div className="mt-2 text-sm text-blue-900">{appointmentEncounter ? "Yes" : "No"}</div>
                          </div>
                        </div>
                      ) : null}

                      {workflowError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          {workflowError}
                        </div>
                      ) : null}

                      {workflowSuccess ? (
                        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                          {workflowSuccess}
                        </div>
                      ) : null}
                    </div>
                  </Section>

                  <Section
                    title="2. Encounter Note Composer"
                    description="Documentation belongs to the encounter created from the appointment."
                  >
                    {!activeEncounter ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                        Select an appointment and create or load its encounter first.
                      </div>
                    ) : (
                      <form onSubmit={handleSaveNote} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="text-sm font-medium text-gray-700">Encounter ID</div>
                            <div className="mt-2 font-mono text-xs text-gray-900">{activeEncounter.id}</div>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="text-sm font-medium text-gray-700">Status</div>
                            <div className="mt-2 text-sm text-gray-900">{activeEncounter.encounter_status ?? "—"}</div>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="text-sm font-medium text-gray-700">Diagnoses</div>
                            <div className="mt-2 text-sm text-gray-900">{activeEncounter.diagnoses.length}</div>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="text-sm font-medium text-gray-700">Service lines</div>
                            <div className="mt-2 text-sm text-gray-900">{activeEncounter.serviceLines.length}</div>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Session summary</label>
                          <textarea
                            rows={3}
                            value={noteDraft.sessionSummary}
                            onChange={(e) => setNoteDraft((current) => ({ ...current, sessionSummary: e.target.value }))}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                          />
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Subjective</label>
                            <textarea rows={5} value={noteDraft.subjective} onChange={(e) => setNoteDraft((c) => ({ ...c, subjective: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Objective</label>
                            <textarea rows={5} value={noteDraft.objective} onChange={(e) => setNoteDraft((c) => ({ ...c, objective: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Assessment</label>
                            <textarea rows={5} value={noteDraft.assessment} onChange={(e) => setNoteDraft((c) => ({ ...c, assessment: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Plan</label>
                            <textarea rows={5} value={noteDraft.plan} onChange={(e) => setNoteDraft((c) => ({ ...c, plan: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">Risk notes</label>
                          <textarea rows={3} value={noteDraft.riskNotes} onChange={(e) => setNoteDraft((c) => ({ ...c, riskNotes: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                        </div>

                        <button type="submit" disabled={savingNote} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                          {savingNote ? "Saving..." : "Save Note"}
                        </button>
                      </form>
                    )}
                  </Section>

                  <Section
                    title="3. Charge Details"
                    description="Service lines are the charge objects generated from the completed note."
                    action={<Link href="/encounters/service-lines/new" className="text-sm text-blue-700 hover:underline">Manual service line</Link>}
                  >
                    {!activeEncounter || activeEncounter.serviceLines.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                        No charges yet for this encounter.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeEncounter.serviceLines
                          .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0))
                          .map((line) => (
                            <div key={line.id} className="rounded-xl border border-gray-200 px-3 py-3 text-sm">
                              <div className="font-medium text-gray-900">
                                {line.sequence_number ?? "—"}. {line.cpt_hcpcs_code ?? "—"} • POS {line.place_of_service_code ?? "—"}
                              </div>
                              <div className="mt-1 text-gray-600">
                                Units {line.units ?? "—"} • Charge {formatMoney(line.charge_amount)}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </Section>

                  <Section
                    title="4. Claims"
                    description="Claims should be created from charges, not directly from loose forms."
                    action={<Link href="/claims/submissions" className="text-sm text-blue-700 hover:underline">Submission queue</Link>}
                  >
                    {claims.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                        No claims yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                              <th className="px-3 py-2">Created</th>
                              <th className="px-3 py-2">Encounter</th>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Charge</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {claims.map((row) => (
                              <tr key={row.id} className="text-sm text-gray-700">
                                <td className="px-3 py-2">{formatDateTime(row.created_at)}</td>
                                <td className="px-3 py-2 font-mono text-xs">{row.encounter_id ?? "—"}</td>
                                <td className="px-3 py-2">{row.claim_status ?? "—"}</td>
                                <td className="px-3 py-2">{formatMoney(row.total_charge_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>
                </div>

                <div className="space-y-6">
                  <Section
                    title="Insurance Snapshot"
                    description="Policy feeds claim creation."
                  >
                    {primaryPolicy ? (
                      <div className="space-y-3 text-sm text-gray-700">
                        <div><span className="font-medium">Policy number:</span> {primaryPolicy.policy_number ?? "—"}</div>
                        <div><span className="font-medium">Plan:</span> {primaryPolicy.plan_name ?? "—"}</div>
                        <div><span className="font-medium">Priority:</span> {primaryPolicy.priority ?? "—"}</div>
                        <div><span className="font-medium">Subscriber ID:</span> {primaryPolicy.subscriber_id ?? "—"}</div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                        No insurance policy found.
                      </div>
                    )}
                  </Section>

                  <Section
                    title="Workflow Status"
                    description="Patient is the anchor record for downstream work."
                  >
                    <div className="space-y-3 text-sm text-gray-700">
                      <div><span className="font-medium">Appointments:</span> {appointments.length}</div>
                      <div><span className="font-medium">Encounters:</span> {encounters.length}</div>
                      <div><span className="font-medium">Claims:</span> {claims.length}</div>
                      <div><span className="font-medium">Selected appointment:</span> {selectedAppointment ? "Yes" : "No"}</div>
                      <div><span className="font-medium">Active encounter:</span> {activeEncounter ? "Yes" : "No"}</div>
                    </div>
                  </Section>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
