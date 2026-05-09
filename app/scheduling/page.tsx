// File: app/scheduling/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import RightWorkflowDrawer from "@/components/workflow/RightWorkflowDrawer";
import EncounterWorkflowTracker from "@/components/workflow/EncounterWorkflowTracker";
import { deriveEncounterWorkflowStatus, type WorkflowStatus } from "@/lib/workflow/deriveEncounterWorkflowStatus";
import type { EncounterRecord, ClaimRecord } from "@/lib/types";
import { useActiveContext } from "@/lib/store/activeContext";

interface AppointmentRecord {
  id: string;
  organization_id?: string | null;
  client_id?: string | null;
  provider_id?: string | null;
  insurance_policy_id?: string | null;
  scheduled_start_at?: string | null;
  scheduled_end_at?: string | null;
  appointment_status?: string | null;
  appointment_type?: string | null;
  reason?: string | null;
}

interface ClientRecord {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}

interface ProviderRecord {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  credential?: string | null;
  is_active?: boolean | null;
  archived_at?: string | null;
}

interface InsurancePolicyRecord {
  id: string;
  client_id: string;
  plan_name?: string | null;
}

interface EligibilityCheck {
  client_id: string;
  eligibilityRequestId: string | null;
  displayStatus: "Active" | "Inactive" | "Not checked" | "Not checked in 30+ days" | "Unknown";
  checkedAt: string | null;
  daysSinceChecked: number | null;
  requestStatus: string | null;
  payerId: string | null;
  payerName: string | null;
  serviceTypeCode: string;
  serviceTypeDescription: string;
  id: string;
  eligibility_status: "active" | "inactive" | "not_checked" | "not_found" | "error" | "unknown";
  copay_amount?: number | null;
  deductible_remaining?: number | null;
  checked_at?: string | null;
  payer_name?: string | null;
  plan_name?: string | null;
}

type ViewMode = "day" | "week" | "month";
type ColorMode = "status" | "type";
type StatusFilter = "all" | "scheduled" | "checked_in" | "completed" | "cancelled" | "no_show";

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 88;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = (day + 6) % 7;
  next.setDate(next.getDate() - diff);
  return next;
}

function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return endOfDay(next);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthGridStart(date: Date) {
  const start = startOfMonth(date);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  return startOfDay(start);
}

function monthGridDays(date: Date) {
  const start = monthGridStart(date);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function weekDays(date: Date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function formatHeaderDate(date: Date, viewMode: ViewMode) {
  if (viewMode === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatBlockTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(startValue: string | null | undefined, endValue: string | null | undefined) {
  if (!startValue || !endValue) return "—";
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes === 0) return "—";
  return `${minutes} min`;
}

function normalizeStatus(status: string | null | undefined): StatusFilter {
  const value = String(status ?? "").toLowerCase();
  if (value === "scheduled") return "scheduled";
  if (value === "checked_in") return "checked_in";
  if (value === "completed") return "completed";
  if (value === "cancelled") return "cancelled";
  if (value === "no_show") return "no_show";
  return "all";
}

function statusLabel(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  if (normalized === "checked_in") return "Checked In";
  if (normalized === "no_show") return "No Show";
  if (normalized === "all") return "Unknown";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function providerLabel(provider: ProviderRecord | undefined) {
  if (!provider) return "Unassigned";
  if (provider.display_name) return provider.display_name;
  const name = [provider.first_name, provider.last_name].filter(Boolean).join(" ");
  return name && provider.credential ? `${name}, ${provider.credential}` : name || provider.id;
}

function patientLabel(patient: ClientRecord | undefined) {
  if (!patient) return "Unknown client";
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  return patient.preferred_name ? `${name || "Client"} (${patient.preferred_name})` : name || patient.id;
}

function statusColor(status: string | null | undefined) {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed") return "border-green-300 bg-green-50 text-green-900";
  if (value === "checked_in") return "border-blue-300 bg-blue-50 text-blue-900";
  if (value === "cancelled" || value === "no_show") return "border-red-300 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function typeColor(type: string | null | undefined) {
  if (type === "Telehealth") return "border-violet-300 bg-violet-50 text-violet-900";
  if (type === "In-person") return "border-sky-300 bg-sky-50 text-sky-900";
  return "border-gray-300 bg-gray-50 text-gray-900";
}

function eligibilityTone(eligibility: EligibilityCheck | null) {
  if (!eligibility) return "bg-gray-100 text-gray-700";
  if (eligibility.displayStatus === "Active") return "bg-green-100 text-green-800";
  if (eligibility.displayStatus === "Inactive") return "bg-red-100 text-red-800";
  if (eligibility.displayStatus === "Not checked in 30+ days") return "bg-amber-100 text-amber-800";
  if (eligibility.displayStatus === "Unknown") return "bg-slate-200 text-slate-800";
  return "bg-gray-100 text-gray-700";
}

function eligibilityLabel(eligibility: EligibilityCheck | null) {
  if (!eligibility) return "Not checked";
  return eligibility.displayStatus;
}

function wasCheckedWithin30Days(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMonthCellLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function SchedulingPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [patients, setPatients] = useState<ClientRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [selectedCheckin, setSelectedCheckin] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [focusDate, setFocusDate] = useState<Date>(() => new Date());
  const [providerFilter, setProviderFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [showWarnings, setShowWarnings] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Global Active Context
  const { patientId, appointmentId, encounterId, setContext, clearContext } = useActiveContext();

  // Workflow-related state for selected appointment
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterRecord | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClaimRecord | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    const [appointmentResp, patientResp, providerResp, policyResp] = await Promise.all([
      supabase.from("appointments").select("*").is("archived_at", null).order("scheduled_start_at", { ascending: true }).limit(500),
      supabase.from("clients").select("id, first_name, last_name, preferred_name").is("archived_at", null).limit(500),
      supabase.from("providers").select("id, display_name, first_name, last_name, credential, is_active, archived_at").eq("is_active", true).is("archived_at", null).order("display_name", { ascending: true }),
      supabase.from("insurance_policies").select("id, client_id, plan_name").is("archived_at", null).limit(500),
    ]);

    if (appointmentResp.error || patientResp.error || providerResp.error || policyResp.error) {
      setError(
        appointmentResp.error?.message ||
          patientResp.error?.message ||
          providerResp.error?.message ||
          policyResp.error?.message ||
            "Could not load calendar workspace."
      );
      setLoading(false);
      return;
    }

    const appointmentRows = (appointmentResp.data ?? []) as AppointmentRecord[];
    setAppointments(appointmentRows);
    setPatients((patientResp.data ?? []) as ClientRecord[]);
    setProviders((providerResp.data ?? []) as ProviderRecord[]);
    setPolicies((policyResp.data ?? []) as InsurancePolicyRecord[]);

    const patientRows = Array.from(
      new Map(
        appointmentRows
          .filter((row) => row.client_id)
          .map((row) => [
            row.client_id as string,
            {
              patientId: row.client_id as string,
              organizationId: row.organization_id || "00000000-0000-0000-0000-000000000000",
            },
          ])
      ).values()
    );

    const eligibilityResponses = await Promise.all(
      patientRows.map(async ({ patientId, organizationId }) => {
        const params = new URLSearchParams({
          organization_id: organizationId,
          patient_id: patientId,
        });
        const response = await fetch(`/api/eligibility/latest?${params.toString()}`);
        if (!response.ok) {
          return {
            id: `latest-${patientId}`,
            client_id: patientId,
            eligibilityRequestId: null,
            eligibility_status: "unknown" as const,
            requestStatus: null,
            payerId: null,
            payerName: null,
            copay_amount: null,
            deductible_remaining: null,
            checked_at: null,
            checkedAt: null,
            daysSinceChecked: null,
            serviceTypeCode: "98",
            serviceTypeDescription: "Professional Services",
            displayStatus: "Not checked" as const,
          } as EligibilityCheck;
        }
        const payload = await response.json();
        const latest = payload?.eligibility;
        if (!latest) {
          return {
            id: `latest-${patientId}`,
            client_id: patientId,
            eligibilityRequestId: null,
            eligibility_status: "unknown" as const,
            requestStatus: null,
            payerId: null,
            payerName: null,
            copay_amount: null,
            deductible_remaining: null,
            checked_at: null,
            checkedAt: null,
            daysSinceChecked: null,
            serviceTypeCode: "98",
            serviceTypeDescription: "Professional Services",
            displayStatus: "Not checked" as const,
          } as EligibilityCheck;
        }

        return {
          id: latest.eligibilityRequestId || `latest-${patientId}`,
          client_id: patientId,
          eligibilityRequestId: latest.eligibilityRequestId,
          eligibility_status: (latest.eligibilityStatus || "unknown") as EligibilityCheck["eligibility_status"],
          requestStatus: latest.requestStatus || null,
          payerId: latest.payerId || null,
          payerName: latest.payerName || null,
          copay_amount: latest.copayAmount ?? null,
          deductible_remaining: latest.deductibleRemaining ?? null,
          checked_at: latest.checkedAt || null,
          checkedAt: latest.checkedAt || null,
          daysSinceChecked: latest.daysSinceChecked ?? null,
          serviceTypeCode: latest.serviceTypeCode || "98",
          serviceTypeDescription: latest.serviceTypeDescription || "Professional Services",
          displayStatus: latest.displayStatus || "Unknown",
        } as EligibilityCheck;
      })
    );
    setEligibilityChecks(eligibilityResponses.filter(Boolean) as EligibilityCheck[]);

    // Load patient check-ins for appointments
    const appointmentIds = appointmentRows.map(row => row.id);
    if (appointmentIds.length > 0) {
      const { data: checkinsData } = await supabase
        .from("patient_checkins")
        .select("*")
        .in("appointment_id", appointmentIds)
        .is("archived_at", null);
      setCheckins(checkinsData ?? []);
    }

    if (appointmentRows[0] && !appointmentId) {
      // Auto-select first appointment if no appointment is selected
      const firstAppointment = appointmentRows[0];
      const firstPatient = (patientResp.data ?? []).find((p: ClientRecord) => p.id === firstAppointment.client_id);
      setContext({
        appointmentId: firstAppointment.id,
        patientId: firstAppointment.client_id ?? null,
        patientName: firstPatient
          ? patientLabel(firstPatient)
          : null,
        appointmentDate: firstAppointment.scheduled_start_at ?? null,
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const patientById = useMemo(() => new Map(patients.map((item) => [item.id, item])), [patients]);
  const providerById = useMemo(() => new Map(providers.map((item) => [item.id, item])), [providers]);
  const policyById = useMemo(() => new Map(policies.map((item) => [item.id, item])), [policies]);
  const eligibilityByPatientId = useMemo(
    () => new Map(eligibilityChecks.map((item) => [item.client_id, item])),
    [eligibilityChecks]
  );
  const checkinByAppointmentId = useMemo(
    () => new Map(checkins.map((item) => [item.appointment_id, item])),
    [checkins]
  );

  const visibleRange = useMemo(() => {
    if (viewMode === "day") return { start: startOfDay(focusDate), end: endOfDay(focusDate) };
    if (viewMode === "week") return { start: startOfWeek(focusDate), end: endOfWeek(focusDate) };
    return { start: startOfMonth(focusDate), end: endOfMonth(focusDate) };
  }, [focusDate, viewMode]);

  const visibleAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const start = appointment.scheduled_start_at ? new Date(appointment.scheduled_start_at) : null;
      if (!start || Number.isNaN(start.getTime())) return false;
      if (start < visibleRange.start || start > visibleRange.end) return false;
      if (providerFilter !== "all" && appointment.provider_id !== providerFilter) return false;
      if (locationFilter !== "all") {
        const derivedLocation = appointment.appointment_type === "Telehealth" ? "telehealth" : "office";
        if (derivedLocation !== locationFilter) return false;
      }
      if (statusFilter !== "all" && normalizeStatus(appointment.appointment_status) !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [appointments, locationFilter, providerFilter, statusFilter, visibleRange.end, visibleRange.start]);

  const providerColumns = useMemo(() => {
    if (providerFilter !== "all") {
      const selected = providerById.get(providerFilter);
      return selected ? [selected] : [];
    }

    const ids = Array.from(new Set(visibleAppointments.map((item) => item.provider_id).filter(Boolean))) as string[];
    const rows = ids.map((id) => providerById.get(id)).filter((value): value is ProviderRecord => Boolean(value));
    return rows.length > 0 ? rows : providers;
  }, [providerById, providerFilter, providers, visibleAppointments]);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === appointmentId) ?? null,
    [appointments, appointmentId]
  );

  const warningCount = useMemo(() => {
    return visibleAppointments.filter((appointment) => {
      const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
      return !eligibility || eligibility.displayStatus !== "Active";
    }).length;
  }, [eligibilityByPatientId, visibleAppointments]);

  const weekColumns = useMemo(() => weekDays(focusDate), [focusDate]);
  const monthDays = useMemo(() => monthGridDays(focusDate), [focusDate]);

  function previousDate() {
    const next = new Date(focusDate);
    if (viewMode === "day") next.setDate(next.getDate() - 1);
    else if (viewMode === "week") next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setFocusDate(next);
  }

  function nextDate() {
    const next = new Date(focusDate);
    if (viewMode === "day") next.setDate(next.getDate() + 1);
    else if (viewMode === "week") next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setFocusDate(next);
  }

  async function runEligibilityForSelected() {
    if (!selectedAppointment?.client_id) return;

    await fetch("/api/clearinghouse/eligibility/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: selectedAppointment.client_id,
        appointmentId: selectedAppointment.id,
        insurancePolicyId: selectedAppointment.insurance_policy_id ?? null,
        serviceTypeCode: "98",
      }),
    });

    await load();
  }

  async function runEligibilityForAppointment(appointmentId: string) {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment?.client_id) return;

    try {
      const response = await fetch("/api/eligibility/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          organizationId: appointment.organization_id,
        }),
      });

      if (response.ok) {
        await load(); // Reload to show updated eligibility
      }
    } catch (error) {
      console.error("Failed to run eligibility:", error);
    }
  }

  async function createEncounterForAppointment(appointmentId: string) {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment?.client_id) return;

    try {
      const response = await fetch("/api/encounters/create-from-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.encounter?.id) {
          router.push(`/encounters/${data.encounter.id}`);
        }
      }
    } catch (error) {
      console.error("Failed to create encounter:", error);
    }
  }

  async function updateAppointmentStatus(appointmentId: string, status: Exclude<StatusFilter, "all">) {
    const now = new Date().toISOString();
    const patch: Record<string, string | null> = {
      appointment_status: status,
      updated_at: now,
    };

    const { error: updateError } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", appointmentId)
      .is("archived_at", null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await load();
  }

  async function loadWorkflowDataForAppointment(appointmentId: string) {
    setWorkflowLoading(true);
    setSelectedEncounter(null);
    setSelectedClaim(null);

    // Find encounter for this appointment
    const { data: encounterData } = await supabase
      .from("encounters")
      .select("*")
      .eq("appointment_id", appointmentId)
      .is("archived_at", null)
      .single();

    if (encounterData) {
      setSelectedEncounter(encounterData as EncounterRecord);

      // Update global context with encounter ID
      setContext({
        encounterId: encounterData.id,
        encounterStatus: encounterData.encounter_status ?? null,
      });

      // Find claim for this encounter
      const { data: claimData } = await supabase
        .from("claims")
        .select("*")
        .eq("encounter_id", encounterData.id)
        .is("archived_at", null)
        .single();

      if (claimData) {
        setSelectedClaim(claimData as ClaimRecord);
      }
    }

    setWorkflowLoading(false);
  }

  function handleAppointmentSelect(selectedAppointmentId: string) {
    const appointment = appointments.find((a) => a.id === selectedAppointmentId);
    if (!appointment) return;

    const patient = patients.find((p) => p.id === appointment.client_id);

    // Set global active context
    setContext({
      organizationId: appointment.organization_id ?? null,
      appointmentId: selectedAppointmentId,
      patientId: appointment.client_id ?? null,
      patientName: patient ? patientLabel(patient) : null,
      appointmentDate: appointment.scheduled_start_at ?? null,
    });

    setDrawerOpen(true);
    void loadWorkflowDataForAppointment(selectedAppointmentId);
  }

  function renderAppointmentChips(dayAppointments: AppointmentRecord[]) {
    if (dayAppointments.length === 0) {
      return <div className="text-xs text-gray-400">No appointments</div>;
    }

    return (
      <div className="space-y-2">
        {dayAppointments
          .sort((a, b) => new Date(a.scheduled_start_at ?? "").getTime() - new Date(b.scheduled_start_at ?? "").getTime())
          .map((appointment) => {
            const patient = appointment.client_id ? patientById.get(appointment.client_id) : undefined;
            const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
            const checkin = checkinByAppointmentId.get(appointment.id);
            const colorClass = colorMode === "status" ? statusColor(appointment.appointment_status) : typeColor(appointment.appointment_type);

            return (
              <div
                key={appointment.id}
                className={`w-full rounded-lg border px-2 py-2 shadow-sm ${colorClass} ${appointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => handleAppointmentSelect(appointment.id)}
                  className="w-full text-left"
                >
                  <div className="text-[11px] font-medium opacity-80">
                    {formatBlockTime(appointment.scheduled_start_at)}
                  </div>
                  <div className="mt-0.5 line-clamp-1 text-xs font-semibold">
                    {patientLabel(patient)}
                  </div>
                  <div className="line-clamp-1 text-[11px] opacity-80">
                    {appointment.reason ?? appointment.appointment_type ?? "Appointment"}
                  </div>
                  <div className="line-clamp-1 text-[11px] opacity-80">
                    {formatDuration(appointment.scheduled_start_at, appointment.scheduled_end_at)} • {statusLabel(appointment.appointment_status)}
                  </div>
                </button>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${eligibilityTone(eligibility)}`}>
                    {eligibilityLabel(eligibility)}
                  </span>
                  {eligibility?.payerName && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                      {eligibility.payerName}
                    </span>
                  )}
                  {eligibility && eligibility.copay_amount !== null && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                      ${eligibility.copay_amount} copay
                    </span>
                  )}
                  {eligibility && eligibility.deductible_remaining !== null && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                      ${eligibility.deductible_remaining} deductible
                    </span>
                  )}
                  {eligibility?.effective_date && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                      Eff: {eligibility.effective_date}
                    </span>
                  )}
                  {eligibility?.termination_date && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                      Term: {eligibility.termination_date}
                    </span>
                  )}
                  {checkin && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                      ✓ Check-in
                    </span>
                  )}
                  {appointment.appointment_type === "Telehealth" && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                      Telehealth
                    </span>
                  )}
                </div>
                {eligibility?.eligibilityRequestId && (
                  <div className="mt-2">
                    <Link
                      href={`/eligibility/requests/${eligibility.eligibilityRequestId}`}
                      onClick={(event) => event.stopPropagation()}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      View Eligibility Report
                    </Link>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateAppointmentStatus(appointment.id, "checked_in");
                    }}
                    className="rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white"
                  >
                    Check in
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void updateAppointmentStatus(appointment.id, "completed");
                    }}
                    className="rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void runEligibilityForAppointment(appointment.id);
                    }}
                    className="rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white"
                  >
                    ✓ Eligibility
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void createEncounterForAppointment(appointment.id);
                    }}
                    className="rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white"
                  >
                    + Encounter
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert("Stripe payment collection placeholder");
                    }}
                    className="rounded bg-white/50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-white"
                  >
                    $ Copay
                  </button>
                  {checkin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCheckin(checkin);
                      }}
                      className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium hover:bg-blue-100"
                    >
                      View Check-in
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f7f7f8]">
        <div className="mx-auto max-w-[1440px] px-4 py-4 lg:px-6">
          <section className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
              <p className="mt-1 text-sm text-gray-600">
                Appointments, availability, eligibility checks, and schedule workflow.
              </p>
            </div>

            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-gray-50 p-3">
              <h2 className="text-sm font-semibold text-gray-900">Calendar Connections</h2>
              <div className="mt-2 space-y-1 text-xs text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Google Calendar</span>
                  <span className="font-medium text-gray-500">Not connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Other calendar</span>
                  <span className="font-medium text-gray-500">Not connected</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="cursor-not-allowed rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500"
                >
                  Connect Google Calendar
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="cursor-not-allowed rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-500"
                >
                  Connect other calendar
                </button>
              </div>
            </div>
          </section>

          {/* Operational Summary Bar */}
          <section className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Today's Appts</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">{visibleAppointments.length}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Encounters Missing</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">—</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Notes Unsigned</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">—</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Eligibility Missing</div>
              <div className="mt-1 text-2xl font-bold text-red-600">{warningCount}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Ready to Bill</div>
              <div className="mt-1 text-2xl font-bold text-green-600">—</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-gray-500">Billing Alerts</div>
              <div className="mt-1 text-2xl font-bold text-red-600">—</div>
            </div>
          </section>

          <div className="grid gap-4">
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">You have {warningCount} warning message{warningCount === 1 ? "" : "s"}</div>
                  <button 
                    type="button" 
                    onClick={() => setShowWarnings((prev) => !prev)} 
                    className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    {showWarnings ? "Hide" : "View"}
                  </button>
                </div>
                {showWarnings && warningCount > 0 && (
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto border-t border-amber-200 pt-3">
                    {visibleAppointments
                      .filter((appointment) => {
                        const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
                        return !eligibility || eligibility.displayStatus !== "Active";
                      })
                      .map((appointment) => {
                        const patient = patients.find((p) => p.id === appointment.client_id);
                        const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
                        const patientName = patient ? [patient.first_name, patient.last_name].filter(Boolean).join(" ") : "";
                        const reason = !eligibility
                          ? "No eligibility check"
                          : eligibility.displayStatus !== "Active"
                            ? `Status: ${eligibility.displayStatus}`
                            : "Eligibility check older than 30 days";
                        
                        return (
                          <div key={appointment.id} className="rounded-lg bg-white p-2 text-xs">
                            <div className="font-medium">{patientName || appointment.client_id}</div>
                            <div className="text-amber-700">{reason}</div>
                            <div className="mt-1 text-gray-600">{formatBlockTime(appointment.scheduled_start_at)}</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setFocusDate(new Date())} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                      Today
                    </button>
                    <button type="button" onClick={previousDate} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                      ‹
                    </button>
                    <button type="button" onClick={nextDate} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                      ›
                    </button>
                    <div className="text-3xl font-semibold tracking-tight text-gray-900">
                      {formatHeaderDate(focusDate, viewMode)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(["day", "week", "month"] as ViewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setViewMode(mode)}
                        className={[
                          "rounded-lg px-3 py-2 text-sm capitalize",
                          viewMode === mode ? "bg-blue-50 text-blue-700" : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {mode}
                      </button>
                    ))}
                    <select
                      value={colorMode}
                      onChange={(event) => setColorMode(event.target.value as ColorMode)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="status">Color: Status</option>
                      <option value="type">Color: Type</option>
                    </select>
                    <Link href="/tickets" className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                      Waitlist
                    </Link>
                    <Link href="/scheduling/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
                      Schedule appointment
                    </Link>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <select
                    value={providerFilter}
                    onChange={(event) => setProviderFilter(event.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All team members</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {providerLabel(provider)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All locations</option>
                    <option value="office">Office</option>
                    <option value="telehealth">Telehealth</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">All statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="checked_in">Checked in</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No show</option>
                  </select>

                  <Link href="/clients/new" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100">
                    New client
                  </Link>
                </div>

                {loading ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                    Loading calendar...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                    {error}
                  </div>
                ) : viewMode === "day" ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[1080px]">
                      <div
                        className="grid border-b border-gray-200"
                        style={{ gridTemplateColumns: `72px repeat(${Math.max(providerColumns.length, 1)}, minmax(0, 1fr))` }}
                      >
                        <div className="border-r border-gray-200 bg-white px-2 py-4 text-center text-xs text-gray-500">
                          <div>All day</div>
                          <div className="mt-1">MT</div>
                        </div>
                        {providerColumns.map((provider) => (
                          <div key={provider.id} className="border-r border-gray-200 px-3 py-4 text-center text-sm font-medium text-gray-700 last:border-r-0">
                            {providerLabel(provider)}
                          </div>
                        ))}
                      </div>

                      <div
                        className="grid"
                        style={{ gridTemplateColumns: `72px repeat(${Math.max(providerColumns.length, 1)}, minmax(0, 1fr))` }}
                      >
                        <div className="relative border-r border-gray-200 bg-white">
                          {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => {
                            const hour = START_HOUR + index;
                            return (
                              <div key={hour} className="border-b border-gray-200 px-2 pt-1 text-right text-xs text-gray-500" style={{ height: `${HOUR_HEIGHT}px` }}>
                                {hour < 12 ? `${hour} am` : hour === 12 ? "12 pm" : `${hour - 12} pm`}
                              </div>
                            );
                          })}
                        </div>

                        {providerColumns.map((provider) => {
                          const providerAppointments = visibleAppointments.filter((item) => item.provider_id === provider.id);
                          return (
                            <div key={provider.id} className="relative border-r border-gray-200 bg-white last:border-r-0" style={{ height: `${(END_HOUR - START_HOUR + 1) * HOUR_HEIGHT}px` }}>
                              {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => (
                                <div key={index} className="border-b border-gray-200" style={{ height: `${HOUR_HEIGHT}px` }} />
                              ))}

                              {providerAppointments.map((appointment) => {
                                const start = new Date(appointment.scheduled_start_at ?? "");
                                const end = new Date(appointment.scheduled_end_at ?? "");
                                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

                                const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
                                const endMinutes = (end.getHours() - START_HOUR) * 60 + end.getMinutes();
                                const top = Math.max(0, (startMinutes / 60) * HOUR_HEIGHT);
                                const height = Math.max(44, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
                                const patient = appointment.client_id ? patientById.get(appointment.client_id) : undefined;
                                const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
                                const colorClass = colorMode === "status" ? statusColor(appointment.appointment_status) : typeColor(appointment.appointment_type);

                                return (
                                  <button
                                    key={appointment.id}
                                    type="button"
                                    onClick={() => handleAppointmentSelect(appointment.id)}
                                    className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left shadow-sm ${colorClass} ${appointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
                                    style={{ top: `${top}px`, height: `${height}px` }}
                                  >
                                    <div className="text-[11px] font-medium opacity-80">
                                      {formatBlockTime(appointment.scheduled_start_at)}
                                    </div>
                                    <div className="mt-0.5 line-clamp-1 text-xs font-semibold">
                                      {patientLabel(patient)}
                                    </div>
                                    <div className="line-clamp-1 text-[11px] opacity-80">
                                      {appointment.reason ?? appointment.appointment_type ?? "Appointment"}
                                    </div>
                                    <div className="line-clamp-1 text-[11px] opacity-80">
                                      {formatDuration(appointment.scheduled_start_at, appointment.scheduled_end_at)} • {statusLabel(appointment.appointment_status)}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${eligibilityTone(eligibility)}`}>
                                        {eligibilityLabel(eligibility)}
                                      </span>
                                      {appointment.appointment_type === "Telehealth" && (
                                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                                          Telehealth
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : viewMode === "week" ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[1080px]">
                      <div className="grid grid-cols-7 border-t border-l border-gray-200">
                        {weekColumns.map((day) => {
                          const dayAppointments = visibleAppointments.filter((item) => {
                            const start = item.scheduled_start_at ? new Date(item.scheduled_start_at) : null;
                            return start ? sameDay(start, day) : false;
                          });

                          return (
                            <div key={day.toISOString()} className="min-h-[540px] border-r border-b border-gray-200 bg-white p-3">
                              <div className="mb-3 border-b border-gray-100 pb-2">
                                <div className="text-sm font-semibold text-gray-900">{formatDayLabel(day)}</div>
                                <div className="mt-1 text-xs text-gray-500">{dayAppointments.length} appointment{dayAppointments.length === 1 ? "" : "s"}</div>
                              </div>
                              {renderAppointmentChips(dayAppointments)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[1080px]">
                      <div className="grid grid-cols-7 border-t border-l border-gray-200">
                        {monthDays.map((day) => {
                          const dayAppointments = appointments.filter((item) => {
                            const start = item.scheduled_start_at ? new Date(item.scheduled_start_at) : null;
                            if (!start) return false;
                            if (!sameDay(start, day)) return false;
                            if (providerFilter !== "all" && item.provider_id !== providerFilter) return false;
                            if (locationFilter !== "all") {
                              const derivedLocation = item.appointment_type === "Telehealth" ? "telehealth" : "office";
                              if (derivedLocation !== locationFilter) return false;
                            }
                            return true;
                          });

                          const inCurrentMonth = day.getMonth() === focusDate.getMonth();

                          return (
                            <div key={day.toISOString()} className={`min-h-[160px] border-r border-b border-gray-200 p-2 ${inCurrentMonth ? "bg-white" : "bg-gray-50"}`}>
                              <div className="mb-2 text-sm font-medium text-gray-900">{formatMonthCellLabel(day)}</div>
                              <div className="space-y-1">
                                {dayAppointments.slice(0, 4).map((appointment) => {
                                  const patient = appointment.client_id ? patientById.get(appointment.client_id) : undefined;
                                  const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
                                  const colorClass = colorMode === "status" ? statusColor(appointment.appointment_status) : typeColor(appointment.appointment_type);

                                  return (
                                    <button
                                      key={appointment.id}
                                      type="button"
                                      onClick={() => handleAppointmentSelect(appointment.id)}
                                      className={`w-full rounded-md border px-2 py-1 text-left shadow-sm ${colorClass} ${appointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
                                    >
                                      <div className="line-clamp-1 text-[11px] font-medium">
                                        {formatBlockTime(appointment.scheduled_start_at)} • {patientLabel(patient)}
                                      </div>
                                      <div className="line-clamp-1 text-[10px] opacity-80">
                                        {statusLabel(appointment.appointment_status)} • {formatDuration(appointment.scheduled_start_at, appointment.scheduled_end_at)}
                                      </div>
                                    </button>
                                  );
                                })}
                                {dayAppointments.length > 4 ? (
                                  <div className="text-[11px] text-gray-500">+{dayAppointments.length - 4} more</div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Encounter Control Panel (Right Drawer) */}
        <RightWorkflowDrawer
          isOpen={drawerOpen && !!selectedAppointment}
          onClose={() => setDrawerOpen(false)}
          title={selectedAppointment ? patientLabel(selectedAppointment.client_id ? patientById.get(selectedAppointment.client_id) : undefined) : ""}
          subtitle={selectedAppointment ? `${formatBlockTime(selectedAppointment.scheduled_start_at)} - ${formatBlockTime(selectedAppointment.scheduled_end_at)}` : ""}
          primaryAction={
            selectedAppointment
              ? {
                  label: (() => {
                    const eligibility = selectedAppointment.client_id ? eligibilityByPatientId.get(selectedAppointment.client_id) ?? null : null;
                    const workflowStatus = deriveEncounterWorkflowStatus({
                      appointment: selectedAppointment,
                      encounter: selectedEncounter,
                      claim: selectedClaim,
                      eligibility: eligibility ? { status: eligibility.eligibility_status, checked_at: eligibility.checkedAt } : null,
                    });
                    return workflowStatus.primaryActionLabel;
                  })(),
                  onClick: () => {
                    if (!selectedEncounter && selectedAppointment) {
                      // Create encounter
                      alert("Navigate to create encounter from appointment " + selectedAppointment.id);
                    } else if (selectedEncounter) {
                      // Navigate to encounter
                      window.location.href = `/encounters/${selectedEncounter.id}`;
                    }
                  },
                }
              : undefined
          }
          secondaryActions={
            selectedAppointment
              ? [
                  {
                    label: "Run Eligibility",
                    onClick: () => void runEligibilityForSelected(),
                  },
                  {
                    label: "Open Client",
                    onClick: () => {
                      if (selectedAppointment?.client_id) {
                        window.location.href = `/patients/${selectedAppointment.client_id}`;
                      }
                    },
                    disabled: !selectedAppointment.client_id,
                  },
                  {
                    label: "Route to Biller",
                    onClick: () => {
                      window.location.href = "/billing";
                    },
                  },
                  {
                    label: "View Claim",
                    onClick: () => {
                      if (selectedClaim) {
                        window.location.href = `/claims/${selectedClaim.id}`;
                      }
                    },
                    disabled: !selectedClaim,
                  },
                ]
              : []
          }
        >
          {selectedAppointment && (
            <div className="space-y-6">
              {/* Appointment Details */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Appointment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Provider:</span>
                    <span className="font-medium">
                      {selectedAppointment.provider_id ? providerLabel(providerById.get(selectedAppointment.provider_id)) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{selectedAppointment.appointment_type ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium capitalize">{selectedAppointment.appointment_status ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reason:</span>
                    <span className="font-medium text-right">{selectedAppointment.reason ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plan:</span>
                    <span className="font-medium text-right">
                      {selectedAppointment.insurance_policy_id
                        ? policyById.get(selectedAppointment.insurance_policy_id)?.plan_name ?? "—"
                        : "—"}
                    </span>
                  </div>
                </div>
              </section>

              {/* Workflow Tracker */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Workflow Progress</h3>
                {workflowLoading ? (
                  <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600">
                    Loading workflow data...
                  </div>
                ) : (
                  <>
                    <EncounterWorkflowTracker
                      status={deriveEncounterWorkflowStatus({
                        appointment: selectedAppointment,
                        encounter: selectedEncounter,
                        claim: selectedClaim,
                        eligibility: selectedAppointment.client_id
                          ? (() => {
                              const e = eligibilityByPatientId.get(selectedAppointment.client_id);
                              return e ? { status: e.eligibility_status, checked_at: e.checkedAt } : null;
                            })()
                          : null,
                      })}
                      orientation="vertical"
                      showLabels={true}
                      compact={false}
                    />
                    {selectedAppointment && (
                      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                        <div className="font-medium">Next Step:</div>
                        <div className="mt-1">
                          {
                            deriveEncounterWorkflowStatus({
                              appointment: selectedAppointment,
                              encounter: selectedEncounter,
                              claim: selectedClaim,
                            }).nextRecommendedAction
                          }
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Eligibility Status */}
              {selectedAppointment.client_id && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Eligibility Status</h3>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="font-medium text-gray-900">Current Status</div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${eligibilityTone(eligibilityByPatientId.get(selectedAppointment.client_id) ?? null)}`}
                      >
                        {eligibilityLabel(eligibilityByPatientId.get(selectedAppointment.client_id) ?? null)}
                      </span>
                    </div>
                    {eligibilityByPatientId.get(selectedAppointment.client_id) && (
                      <div className="space-y-1 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span>Payer:</span>
                          <span>
                            {(eligibilityByPatientId.get(selectedAppointment.client_id)?.payerName ?? "—")}
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.payerId
                              ? ` (${eligibilityByPatientId.get(selectedAppointment.client_id)?.payerId})`
                              : ""}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Service Type:</span>
                          <span>
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.serviceTypeCode ?? "98"} {" "}
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.serviceTypeDescription ?? "Professional Services"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Copay:</span>
                          <span>
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.copay_amount
                              ? `$${eligibilityByPatientId.get(selectedAppointment.client_id)!.copay_amount}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Deductible remaining:</span>
                          <span>
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.deductible_remaining
                              ? `$${eligibilityByPatientId.get(selectedAppointment.client_id)!.deductible_remaining}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective:</span>
                          <span>{eligibilityByPatientId.get(selectedAppointment.client_id)?.effective_date ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Termination:</span>
                          <span>{eligibilityByPatientId.get(selectedAppointment.client_id)?.termination_date ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Checked:</span>
                          <span className="text-right">
                            {eligibilityByPatientId.get(selectedAppointment.client_id)?.checkedAt
                              ? new Date(
                                  eligibilityByPatientId.get(selectedAppointment.client_id)!.checkedAt!
                                ).toLocaleDateString()
                              : "Not checked"}
                          </span>
                        </div>
                        {eligibilityByPatientId.get(selectedAppointment.client_id)?.eligibilityRequestId && (
                          <div className="pt-2">
                            <Link
                              href={`/eligibility/requests/${eligibilityByPatientId.get(selectedAppointment.client_id)?.eligibilityRequestId}`}
                              className="inline-flex rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              View Eligibility Report
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                    {eligibilityByPatientId.get(selectedAppointment.client_id)?.displayStatus === "Not checked in 30+ days" && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        ⚠️ Eligibility has not been checked within 30 days
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Encounter Summary */}
              {selectedEncounter && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Encounter Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium capitalize">{selectedEncounter.encounter_status ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Date:</span>
                      <span className="font-medium">{selectedEncounter.service_date ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Billing Ready:</span>
                      <span className="font-medium">{selectedEncounter.required_billing_fields_complete ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Claim Summary */}
              {selectedClaim && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">Claim Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Claim #:</span>
                      <span className="font-medium font-mono text-xs">{selectedClaim.claim_number ?? selectedClaim.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium capitalize">{selectedClaim.claim_status ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium">
                        {selectedClaim.total_charge_amount ? `$${selectedClaim.total_charge_amount}` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Submitted:</span>
                      <span className="font-medium">
                        {selectedClaim.submitted_at
                          ? new Date(selectedClaim.submitted_at).toLocaleDateString()
                          : "Not submitted"}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Warnings & Alerts */}
              {(() => {
                const workflowStatus = deriveEncounterWorkflowStatus({
                  appointment: selectedAppointment,
                  encounter: selectedEncounter,
                  claim: selectedClaim,
                  eligibility: selectedAppointment.client_id
                    ? (() => {
                        const e = eligibilityByPatientId.get(selectedAppointment.client_id!);
                        return e ? { status: e.eligibility_status, checked_at: e.checkedAt } : null;
                      })()
                    : null,
                });
                const hasWarnings = workflowStatus.warnings.length > 0 || workflowStatus.blockedReasons.length > 0;

                return hasWarnings ? (
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-gray-900">Alerts & Warnings</h3>
                    <div className="space-y-2">
                      {workflowStatus.blockedReasons.map((reason, index) => (
                        <div key={`blocked-${index}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                          🛑 {reason}
                        </div>
                      ))}
                      {workflowStatus.warnings.map((warning, index) => (
                        <div key={`warning-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          ⚠️ {warning}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null;
              })()}
            </div>
          )}
        </RightWorkflowDrawer>
      </main>

      {/* Check-in Preview Modal */}
      {selectedCheckin && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedCheckin(null)}
        >
          <div 
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Patient Check-in</h2>
              <button
                onClick={() => setSelectedCheckin(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500">Status</div>
                <div className="mt-1 text-sm text-gray-900">{selectedCheckin.status}</div>
              </div>
              
              {selectedCheckin.submitted_at && (
                <div>
                  <div className="text-xs font-medium text-gray-500">Submitted</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {new Date(selectedCheckin.submitted_at).toLocaleString()}
                  </div>
                </div>
              )}

              {(selectedCheckin.h0031_signal || selectedCheckin.h0001_signal || selectedCheckin.h0032_signal) && (
                <div>
                  <div className="text-xs font-medium text-gray-500">Code Suggestions</div>
                  <div className="mt-2 space-y-2">
                    {selectedCheckin.h0031_signal && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
                        <div className="text-xs font-semibold text-blue-900">90837 - Psychotherapy 60 min</div>
                        <div className="mt-0.5 text-xs text-blue-700">Signal: {selectedCheckin.h0031_signal}</div>
                      </div>
                    )}
                    {selectedCheckin.h0001_signal && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                        <div className="text-xs font-semibold text-green-900">90791 - Psychiatric Diagnostic Evaluation</div>
                        <div className="mt-0.5 text-xs text-green-700">Signal: {selectedCheckin.h0001_signal}</div>
                      </div>
                    )}
                    {selectedCheckin.h0032_signal && (
                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
                        <div className="text-xs font-semibold text-purple-900">90832 - Psychotherapy 30 min</div>
                        <div className="mt-0.5 text-xs text-purple-700">Signal: {selectedCheckin.h0032_signal}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedCheckin.patient_notes && (
                <div>
                  <div className="text-xs font-medium text-gray-500">Patient Notes</div>
                  <div className="mt-1 text-sm text-gray-900">{selectedCheckin.patient_notes}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedCheckin(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
