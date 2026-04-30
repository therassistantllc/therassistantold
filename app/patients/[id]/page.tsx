// File: app/patients/[id]/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import { useActiveContext } from "@/lib/store/activeContext";
import { deriveEncounterWorkflowStatus } from "@/lib/workflow/deriveEncounterWorkflowStatus";
import {
  createEncounter,
  createNote,
  createServiceLine,
  createClaim,
  submitClaim,
  postPayment,
  type WorkflowContext,
} from "@/lib/workflow/workflowFunctions";
import type {
  ClientRecord,
  AppointmentRecord,
  EncounterRecord,
  ClaimRecord,
  InsurancePolicyRecord,
} from "@/lib/types";

type TabKey =
  | "overview"
  | "demographics"
  | "insurance"
  | "appointments"
  | "encounters"
  | "notes"
  | "claims"
  | "payments"
  | "documents"
  | "messages"
  | "activity";

interface Note {
  id: string;
  encounter_id?: string | null;
  status?: string | null;
  signed_at?: string | null;
  created_at?: string | null;
  provider_id?: string | null;
  client_id?: string | null;
}

interface Payment {
  id: string;
  claim_id?: string | null;
  amount?: string | null;
  payment_date?: string | null;
  payment_type?: string | null;
  posted_at?: string | null;
  client_id?: string | null;
}

export default function PatientWorkspacePage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { setContext } = useActiveContext();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [patient, setPatient] = useState<ClientRecord | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [insurancePolicies, setInsurancePolicies] = useState<InsurancePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  useEffect(() => {
    if (patientId && patient) {
      const patientName =
        [patient.first_name, patient.last_name].filter(Boolean).join(" ") ||
        patient.preferred_name ||
        `Patient ${patientId.slice(0, 8)}`;

      setContext({
        patientId,
        patientName,
      });
    }
  }, [patientId, patient, setContext]);

  useEffect(() => {
    if (!patientId) return;

    let active = true;

    async function loadPatientData() {
      setLoading(true);
      setError(null);

      try {
        const [patientResult, appointmentsResult, encountersResult, claimsResult, notesResult, paymentsResult, insuranceResult] =
          await Promise.all([
            supabase.from("clients").select("*").eq("id", patientId).is("archived_at", null).single(),
            supabase
              .from("appointments")
              .select("*")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("scheduled_start_at", { ascending: false })
              .limit(50),
            supabase
              .from("encounters")
              .select("*")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("service_date", { ascending: false })
              .limit(50),
            supabase
              .from("claims")
              .select("*")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("created_at", { ascending: false })
              .limit(50),
            supabase
              .from("encounter_notes")
              .select("id, encounter_id, status, signed_at, created_at, provider_id, client_id")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("created_at", { ascending: false })
              .limit(50),
            supabase
              .from("payments")
              .select("id, claim_id, amount, payment_date, payment_type, posted_at, client_id")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("payment_date", { ascending: false })
              .limit(50),
            supabase
              .from("insurance_policies")
              .select("*")
              .eq("client_id", patientId)
              .is("archived_at", null)
              .order("priority", { ascending: true }),
          ]);

        if (!active) return;

        if (patientResult.error) {
          setError(patientResult.error.message);
          setLoading(false);
          return;
        }

        setPatient(patientResult.data as ClientRecord);
        setAppointments((appointmentsResult.data ?? []) as AppointmentRecord[]);
        setEncounters((encountersResult.data ?? []) as EncounterRecord[]);
        setClaims((claimsResult.data ?? []) as ClaimRecord[]);
        setNotes((notesResult.data ?? []) as Note[]);
        setPayments((paymentsResult.data ?? []) as Payment[]);
        setInsurancePolicies((insuranceResult.data ?? []) as InsurancePolicyRecord[]);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load patient data");
        setLoading(false);
      }
    }

    void loadPatientData();

    return () => {
      active = false;
    };
  }, [patientId]);

  const balances = useMemo(() => {
    const totalClaimed = claims.reduce((sum, claim) => {
      const amount = parseFloat(String(claim.total_charge_amount ?? "0"));
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

    const totalPaid = payments.reduce((sum, payment) => {
      const amount = parseFloat(String(payment.amount ?? "0"));
      return sum + (isFinite(amount) ? amount : 0);
    }, 0);

    return {
      patientBalance: Math.max(0, totalClaimed * 0.2 - totalPaid * 0.1),
      insuranceBalance: Math.max(0, totalClaimed * 0.8 - totalPaid * 0.9),
    };
  }, [claims, payments]);

  const { nextAppointment, lastAppointment } = useMemo(() => {
    const now = new Date();
    const upcoming = appointments
      .filter((a) => new Date(a.scheduled_start_at ?? "") > now)
      .sort((a, b) => new Date(a.scheduled_start_at ?? "").getTime() - new Date(b.scheduled_start_at ?? "").getTime());

    const past = appointments
      .filter((a) => new Date(a.scheduled_start_at ?? "") <= now)
      .sort((a, b) => new Date(b.scheduled_start_at ?? "").getTime() - new Date(a.scheduled_start_at ?? "").getTime());

    return {
      nextAppointment: upcoming[0] || null,
      lastAppointment: past[0] || null,
    };
  }, [appointments]);

  const primaryInsurance = insurancePolicies.find((p) => p.priority === 1 || p.priority === "1");

  const alerts = useMemo(() => {
    const alertList: string[] = [];

    if (balances.patientBalance > 100) {
      alertList.push("Outstanding patient balance");
    }

    if (!primaryInsurance || !primaryInsurance.active_flag) {
      alertList.push("No active insurance");
    }

    const pendingClaims = claims.filter((c) => c.claim_status?.toLowerCase() === "pending" || c.claim_status?.toLowerCase() === "submitted");
    if (pendingClaims.length > 3) {
      alertList.push(`${pendingClaims.length} claims pending`);
    }

    const unsignedNotes = notes.filter((n) => !n.signed_at);
    if (unsignedNotes.length > 0) {
      alertList.push(`${unsignedNotes.length} unsigned notes`);
    }

    return alertList;
  }, [balances, primaryInsurance, claims, notes]);

  // Get workflow context for active appointment
  const { organizationId, appointmentId } = useActiveContext();
  const activeAppointment = useMemo(() => {
    if (!appointmentId) return null;
    return appointments.find((a) => a.id === appointmentId) || null;
  }, [appointmentId, appointments]);

  const activeEncounter = useMemo(() => {
    if (!appointmentId) return null;
    return encounters.find((e) => e.appointment_id === appointmentId) || null;
  }, [appointmentId, encounters]);

  const activeClaim = useMemo(() => {
    if (!activeEncounter) return null;
    return claims.find((c) => c.encounter_id === activeEncounter.id) || null;
  }, [activeEncounter, claims]);

  const activeNote = useMemo(() => {
    if (!activeEncounter) return null;
    return notes.find((n) => n.encounter_id === activeEncounter.id) || null;
  }, [activeEncounter, notes]);

  // Workflow handlers
  async function handleCreateEncounter() {
    if (!organizationId || !patientId || !appointmentId || !activeAppointment) {
      setWorkflowMessage({ type: "error", text: "Missing required context. Please select an appointment first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId,
      providerId: activeAppointment.provider_id!,
      insurancePolicyId: activeAppointment.insurance_policy_id || null,
    };

    const result = await createEncounter(supabase, ctx, appointmentId);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Encounter created successfully!" });
      // Reload encounters
      const { data } = await supabase
        .from("encounters")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(50);
      setEncounters((data ?? []) as EncounterRecord[]);
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to create encounter" });
    }

    setWorkflowLoading(false);
  }

  async function handleSignNote() {
    if (!organizationId || !activeEncounter) {
      setWorkflowMessage({ type: "error", text: "No encounter found. Create an encounter first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId!,
      providerId: activeEncounter.provider_id!,
      insurancePolicyId: activeAppointment?.insurance_policy_id || null,
    };

    const result = await createNote(supabase, ctx, activeEncounter.id);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Note signed successfully!" });
      // Reload notes
      const { data } = await supabase
        .from("encounter_notes")
        .select("id, encounter_id, status, signed_at, created_at, provider_id, client_id")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setNotes((data ?? []) as Note[]);
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to sign note" });
    }

    setWorkflowLoading(false);
  }

  async function handleCreateServiceLine() {
    if (!organizationId || !activeEncounter) {
      setWorkflowMessage({ type: "error", text: "No encounter found. Create an encounter first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId!,
      providerId: activeEncounter.provider_id!,
      insurancePolicyId: activeAppointment?.insurance_policy_id || null,
    };

    const result = await createServiceLine(supabase, ctx, activeEncounter.id);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Service line created successfully!" });
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to create service line" });
    }

    setWorkflowLoading(false);
  }

  async function handleCreateClaim() {
    if (!organizationId || !activeEncounter) {
      setWorkflowMessage({ type: "error", text: "No encounter found. Create an encounter first." });
      return;
    }

    if (!activeNote) {
      setWorkflowMessage({ type: "error", text: "No signed note found. Sign a note first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId!,
      providerId: activeEncounter.provider_id!,
      insurancePolicyId: activeAppointment?.insurance_policy_id || null,
    };

    const result = await createClaim(supabase, ctx, activeEncounter.id);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Claim created successfully!" });
      // Reload claims
      const { data } = await supabase
        .from("claims")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setClaims((data ?? []) as ClaimRecord[]);
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to create claim" });
    }

    setWorkflowLoading(false);
  }

  async function handleSubmitClaim() {
    if (!organizationId || !activeClaim) {
      setWorkflowMessage({ type: "error", text: "No claim found. Create a claim first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId!,
      providerId: activeEncounter?.provider_id!,
      insurancePolicyId: activeAppointment?.insurance_policy_id || null,
    };

    const result = await submitClaim(supabase, ctx, activeClaim.id);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Claim submitted successfully!" });
      // Reload claims
      const { data } = await supabase
        .from("claims")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setClaims((data ?? []) as ClaimRecord[]);
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to submit claim" });
    }

    setWorkflowLoading(false);
  }

  async function handlePostPayment() {
    if (!organizationId || !activeClaim) {
      setWorkflowMessage({ type: "error", text: "No claim found. Create a claim first." });
      return;
    }

    setWorkflowLoading(true);
    setWorkflowMessage(null);

    const ctx: WorkflowContext = {
      organizationId,
      clientId: patientId!,
      providerId: activeEncounter?.provider_id!,
      insurancePolicyId: activeAppointment?.insurance_policy_id || null,
    };

    const result = await postPayment(supabase, ctx, activeClaim.id);

    if (result.success) {
      setWorkflowMessage({ type: "success", text: "Payment posted successfully!" });
      // Reload claims to see updated status
      const { data } = await supabase
        .from("claims")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setClaims((data ?? []) as ClaimRecord[]);
    } else {
      setWorkflowMessage({ type: "error", text: result.error || "Failed to post payment" });
    }

    setWorkflowLoading(false);
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "demographics", label: "Demographics" },
    { key: "insurance", label: "Insurance" },
    { key: "appointments", label: "Appointments" },
    { key: "encounters", label: "Encounters" },
    { key: "notes", label: "Notes" },
    { key: "claims", label: "Claims" },
    { key: "payments", label: "Payments" },
    { key: "documents", label: "Documents" },
    { key: "messages", label: "Messages" },
    { key: "activity", label: "Activity Log" },
  ];

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-gray-600">Loading patient workspace...</div>
        </div>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error || "Patient not found"}
          </div>
        </div>
      </AppShell>
    );
  }

  const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || patient.preferred_name || `Patient ${patientId.slice(0, 8)}`;

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        <div className="border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{patientName}</h1>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                  <div><span className="font-medium">DOB:</span> {patient.date_of_birth || "—"}</div>
                  <div><span className="font-medium">Phone:</span> {patient.phone || "—"}</div>
                  <div><span className="font-medium">Email:</span> {patient.email || "—"}</div>
                  <div><span className="font-medium">MRN:</span> {patient.mrn || "—"}</div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="rounded-lg bg-blue-50 px-3 py-1 text-sm">
                    <span className="font-medium text-blue-900">Insurance:</span>{" "}
                    <span className="text-blue-700">{primaryInsurance?.plan_name || "No insurance"}</span>
                  </div>
                  {primaryInsurance?.active_flag ? (
                    <div className="rounded-lg bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                      Active
                    </div>
                  ) : (
                    <div className="rounded-lg bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                      Inactive
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Patient Balance:</span>{" "}
                    <span className={balances.patientBalance > 0 ? "font-semibold text-red-700" : "text-gray-900"}>
                      ${balances.patientBalance.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Insurance Balance:</span>{" "}
                    <span className="text-gray-900">${balances.insuranceBalance.toFixed(2)}</span>
                  </div>
                  {nextAppointment && (
                    <div>
                      <span className="font-medium text-gray-700">Next Appt:</span>{" "}
                      <span className="text-gray-900">
                        {new Date(nextAppointment.scheduled_start_at ?? "").toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {lastAppointment && !nextAppointment && (
                    <div>
                      <span className="font-medium text-gray-700">Last Appt:</span>{" "}
                      <span className="text-gray-900">
                        {new Date(lastAppointment.scheduled_start_at ?? "").toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {alerts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
                      >
                        ⚠ {alert}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/scheduling"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  New Appointment
                </Link>
                <Link
                  href="/encounters/new"
                  className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Create Encounter
                </Link>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-6">
            <div className="flex gap-1 overflow-x-auto border-t border-gray-200 pt-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {activeTab === "overview" ? (
            <div className="space-y-6">
              {/* Workflow Message Banner */}
              {workflowMessage && (
                <div
                  className={`rounded-lg p-4 ${
                    workflowMessage.type === "success"
                      ? "bg-green-50 border border-green-200 text-green-800"
                      : "bg-red-50 border border-red-200 text-red-800"
                  }`}
                >
                  {workflowMessage.text}
                </div>
              )}

              {/* Active Context Info */}
              {appointmentId && activeAppointment ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-blue-900">Active Appointment</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <div>Appointment ID: {appointmentId.substring(0, 8)}...</div>
                    <div>Provider ID: {activeAppointment.provider_id?.substring(0, 8)}...</div>
                    <div>Scheduled: {activeAppointment.scheduled_start_at ? new Date(activeAppointment.scheduled_start_at).toLocaleString() : "—"}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm">
                  <p className="text-sm text-gray-600">
                    No active appointment selected. Click an appointment from the Scheduling page to start the workflow.
                  </p>
                </div>
              )}

              {/* Workflow Status */}
              {activeAppointment && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeEncounter ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {activeEncounter ? "✓" : "1"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Encounter</div>
                        <div className="text-sm text-gray-600">
                          {activeEncounter ? `Created: ${activeEncounter.id.substring(0, 8)}...` : "Not created"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeNote ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {activeNote ? "✓" : "2"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Clinical Note</div>
                        <div className="text-sm text-gray-600">
                          {activeNote ? `Signed: ${activeNote.id.substring(0, 8)}...` : "Not signed"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeClaim ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {activeClaim ? "✓" : "3"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">Claim</div>
                        <div className="text-sm text-gray-600">
                          {activeClaim ? `Status: ${activeClaim.claim_status}` : "Not created"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Workflow Action Buttons */}
              {activeAppointment && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Actions</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      onClick={handleCreateEncounter}
                      disabled={workflowLoading || !!activeEncounter}
                      className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeEncounter ? "✓ Encounter Created" : "1. Create Encounter"}
                    </button>
                    
                    <button
                      onClick={handleSignNote}
                      disabled={workflowLoading || !activeEncounter || !!activeNote}
                      className="rounded-lg border border-green-600 bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeNote ? "✓ Note Signed" : "2. Sign Note"}
                    </button>

                    <button
                      onClick={handleCreateServiceLine}
                      disabled={workflowLoading || !activeNote}
                      className="rounded-lg border border-purple-600 bg-purple-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      3. Create Service Line
                    </button>
                    
                    <button
                      onClick={handleCreateClaim}
                      disabled={workflowLoading || !activeNote || !!activeClaim}
                      className="rounded-lg border border-orange-600 bg-orange-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeClaim ? "✓ Claim Created" : "4. Create Claim"}
                    </button>
                    
                    <button
                      onClick={handleSubmitClaim}
                      disabled={workflowLoading || !activeClaim || activeClaim?.claim_status === "submitted" || activeClaim?.claim_status === "paid"}
                      className="rounded-lg border border-pink-600 bg-pink-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeClaim?.claim_status === "submitted" || activeClaim?.claim_status === "paid" ? "✓ Claim Submitted" : "5. Submit Claim"}
                    </button>
                    
                    <button
                      onClick={handlePostPayment}
                      disabled={workflowLoading || !activeClaim || activeClaim?.claim_status !== "submitted"}
                      className="rounded-lg border border-teal-600 bg-teal-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {activeClaim?.claim_status === "paid" ? "✓ Payment Posted" : "6. Post Payment"}
                    </button>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="text-xl font-bold text-blue-900">{appointments.length}</div>
                  <div className="text-sm text-blue-700">Appointments</div>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <div className="text-xl font-bold text-green-900">{encounters.length}</div>
                  <div className="text-sm text-green-700">Encounters</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-4">
                  <div className="text-xl font-bold text-purple-900">{claims.length}</div>
                  <div className="text-sm text-purple-700">Claims</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Patient Workspace Tab: {activeTab}</h2>
              <p className="mt-4 text-sm text-gray-600">
                Comprehensive tab content for {activeTab} is being implemented.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="text-xl font-bold text-blue-900">{appointments.length}</div>
                  <div className="text-sm text-blue-700">Appointments</div>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <div className="text-xl font-bold text-green-900">{encounters.length}</div>
                  <div className="text-sm text-green-700">Encounters</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-4">
                  <div className="text-xl font-bold text-purple-900">{claims.length}</div>
                  <div className="text-sm text-purple-700">Claims</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
