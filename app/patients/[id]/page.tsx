// File: app/patients/[id]/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import { useActiveContext } from "@/lib/store/activeContext";
import { deriveEncounterWorkflowStatus } from "@/lib/workflow/deriveEncounterWorkflowStatus";
import type {
  ClientRecord,
  AppointmentRecord,
  EncounterRecord,
  ClaimRecord,
  InsurancePolicyRecord,
} from "@/lib/types";
import {
  CalendarIcon,
  DocumentTextIcon,
  CreditCardIcon,
  BanknotesIcon,
  DocumentDuplicateIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClipboardDocumentListIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

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

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<any> }> = [
    { key: "overview", label: "Overview", icon: ClipboardDocumentListIcon },
    { key: "demographics", label: "Demographics", icon: UserIcon },
    { key: "insurance", label: "Insurance", icon: CreditCardIcon },
    { key: "appointments", label: "Appointments", icon: CalendarIcon },
    { key: "encounters", label: "Encounters", icon: DocumentTextIcon },
    { key: "notes", label: "Notes", icon: DocumentDuplicateIcon },
    { key: "claims", label: "Claims", icon: ClipboardDocumentListIcon },
    { key: "payments", label: "Payments", icon: BanknotesIcon },
    { key: "documents", label: "Documents", icon: DocumentDuplicateIcon },
    { key: "messages", label: "Messages", icon: ChatBubbleLeftIcon },
    { key: "activity", label: "Activity Log", icon: ClockIcon },
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
                    <div className="flex items-center gap-1 text-sm text-green-700">
                      <CheckCircleIcon className="h-4 w-4" />
                      <span>Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-red-700">
                      <XCircleIcon className="h-4 w-4" />
                      <span>Inactive</span>
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
                        className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800"
                      >
                        <ExclamationTriangleIcon className="h-3 w-3" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/scheduling"
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <CalendarIcon className="h-4 w-4" />
                  New Appointment
                </Link>
                <Link
                  href="/encounters/new"
                  className="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  Create Encounter
                </Link>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-6">
            <div className="flex gap-1 overflow-x-auto border-t border-gray-200 pt-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
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
        </div>
      </div>
    </AppShell>
  );
}
