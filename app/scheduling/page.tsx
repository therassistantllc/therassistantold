// File: app/scheduling/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface AppointmentRecord {
  id: string;
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
  id: string;
  patient_id: string;
  status: "active" | "inactive" | "not_found" | "error" | "unknown";
  copay_amount?: number | null;
  deductible_remaining?: number | null;
  checked_at?: string | null;
  payer_name?: string | null;
  plan_name?: string | null;
}

type ViewMode = "day" | "week" | "month";
type ColorMode = "status" | "type";

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

function providerLabel(provider: ProviderRecord | undefined) {
  if (!provider) return "Unassigned";
  if (provider.display_name) return provider.display_name;
  const name = [provider.first_name, provider.last_name].filter(Boolean).join(" ");
  return name && provider.credential ? `${name}, ${provider.credential}` : name || provider.id;
}

function patientLabel(patient: ClientRecord | undefined) {
  if (!patient) return "Unknown patient";
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(" ");
  return patient.preferred_name ? `${name || "Patient"} (${patient.preferred_name})` : name || patient.id;
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
  if (eligibility.status === "active") return "bg-green-100 text-green-800";
  if (eligibility.status === "inactive" || eligibility.status === "not_found") return "bg-red-100 text-red-800";
  if (eligibility.status === "error") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

function eligibilityLabel(eligibility: EligibilityCheck | null) {
  if (!eligibility) return "Not Checked";
  if (eligibility.status === "active") return "Eligible";
  if (eligibility.status === "inactive") return "Inactive";
  if (eligibility.status === "not_found") return "Not Found";
  if (eligibility.status === "error") return "Error";
  return "Unknown";
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
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [patients, setPatients] = useState<ClientRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [eligibilityChecks, setEligibilityChecks] = useState<EligibilityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [focusDate, setFocusDate] = useState<Date>(() => new Date("2026-04-24T09:00:00"));
  const [providerFilter, setProviderFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>("");

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
          "Could not load scheduling workspace."
      );
      setLoading(false);
      return;
    }

    const appointmentRows = (appointmentResp.data ?? []) as AppointmentRecord[];
    setAppointments(appointmentRows);
    setPatients((patientResp.data ?? []) as ClientRecord[]);
    setProviders((providerResp.data ?? []) as ProviderRecord[]);
    setPolicies((policyResp.data ?? []) as InsurancePolicyRecord[]);

    const patientIds = Array.from(new Set(appointmentRows.map((row) => row.client_id).filter(Boolean))) as string[];
    const eligibilityResponses = await Promise.all(
      patientIds.map(async (patientId) => {
        const response = await fetch(`/api/patients/${patientId}/eligibility`);
        if (!response.ok) return null;
        const payload = await response.json();
        return payload.latest as EligibilityCheck | null;
      })
    );
    setEligibilityChecks(eligibilityResponses.filter(Boolean) as EligibilityCheck[]);

    if (appointmentRows[0]) {
      setSelectedAppointmentId(appointmentRows[0].id);
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
    () => new Map(eligibilityChecks.map((item) => [item.patient_id, item])),
    [eligibilityChecks]
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
      return true;
    });
  }, [appointments, locationFilter, providerFilter, visibleRange.end, visibleRange.start]);

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
    () => appointments.find((item) => item.id === selectedAppointmentId) ?? null,
    [appointments, selectedAppointmentId]
  );

  const warningCount = useMemo(() => {
    return visibleAppointments.filter((appointment) => {
      const eligibility = appointment.client_id ? eligibilityByPatientId.get(appointment.client_id) ?? null : null;
      return !eligibility || eligibility.status !== "active" || !wasCheckedWithin30Days(eligibility.checked_at);
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
            const colorClass = colorMode === "status" ? statusColor(appointment.appointment_status) : typeColor(appointment.appointment_type);

            return (
              <button
                key={appointment.id}
                type="button"
                onClick={() => setSelectedAppointmentId(appointment.id)}
                className={`w-full rounded-lg border px-2 py-2 text-left shadow-sm ${colorClass} ${selectedAppointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
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
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${eligibilityTone(eligibility)}`}>
                    {eligibilityLabel(eligibility)}
                  </span>
                </div>
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#f7f7f8]">
        <div className="mx-auto max-w-[1440px] px-4 py-4 lg:px-6">
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-center justify-between gap-4">
                  <div className="font-medium">You have {warningCount} warning message{warningCount === 1 ? "" : "s"}</div>
                  <button type="button" className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white">
                    View
                  </button>
                </div>
              </div>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setFocusDate(new Date("2026-04-24T09:00:00"))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
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
                                    onClick={() => setSelectedAppointmentId(appointment.id)}
                                    className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-left shadow-sm ${colorClass} ${selectedAppointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
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
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${eligibilityTone(eligibility)}`}>
                                        {eligibilityLabel(eligibility)}
                                      </span>
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
                                      onClick={() => setSelectedAppointmentId(appointment.id)}
                                      className={`w-full rounded-md border px-2 py-1 text-left shadow-sm ${colorClass} ${selectedAppointmentId === appointment.id ? "ring-2 ring-blue-400" : ""}`}
                                    >
                                      <div className="line-clamp-1 text-[11px] font-medium">
                                        {formatBlockTime(appointment.scheduled_start_at)} • {patientLabel(patient)}
                                      </div>
                                      <div className="line-clamp-1 text-[10px] opacity-80">
                                        {eligibilityLabel(eligibility)}
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

            <aside className="space-y-4">
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Appointment Drawer</h2>
                {!selectedAppointment ? (
                  <div className="mt-4 text-sm text-gray-600">Select an appointment block to open details.</div>
                ) : (
                  <div className="mt-4 space-y-4 text-sm text-gray-700">
                    <div>
                      <div className="text-base font-semibold text-gray-900">
                        {patientLabel(selectedAppointment.client_id ? patientById.get(selectedAppointment.client_id) : undefined)}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {formatBlockTime(selectedAppointment.scheduled_start_at)} - {formatBlockTime(selectedAppointment.scheduled_end_at)}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <div><span className="font-medium">Provider:</span> {selectedAppointment.provider_id ? providerLabel(providerById.get(selectedAppointment.provider_id)) : "—"}</div>
                      <div><span className="font-medium">Appointment type:</span> {selectedAppointment.appointment_type ?? "—"}</div>
                      <div><span className="font-medium">Reason:</span> {selectedAppointment.reason ?? "—"}</div>
                      <div><span className="font-medium">Status:</span> {selectedAppointment.appointment_status ?? "—"}</div>
                      <div><span className="font-medium">Plan:</span> {selectedAppointment.insurance_policy_id ? policyById.get(selectedAppointment.insurance_policy_id)?.plan_name ?? "—" : "—"}</div>
                    </div>

                    {selectedAppointment.client_id ? (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="font-medium text-gray-900">Eligibility</div>
                          <span className={`rounded-full px-2 py-1 text-xs ${eligibilityTone(eligibilityByPatientId.get(selectedAppointment.client_id) ?? null)}`}>
                            {eligibilityLabel(eligibilityByPatientId.get(selectedAppointment.client_id) ?? null)}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-700">
                          <div>Payer: {eligibilityByPatientId.get(selectedAppointment.client_id)?.payer_name ?? "—"}</div>
                          <div>Plan: {eligibilityByPatientId.get(selectedAppointment.client_id)?.plan_name ?? "—"}</div>
                          <div>Copay: {eligibilityByPatientId.get(selectedAppointment.client_id)?.copay_amount ?? "—"}</div>
                          <div>Deductible remaining: {eligibilityByPatientId.get(selectedAppointment.client_id)?.deductible_remaining ?? "—"}</div>
                          <div>Last checked: {eligibilityByPatientId.get(selectedAppointment.client_id)?.checked_at ?? "Not checked"}</div>
                        </div>
                        {!wasCheckedWithin30Days(eligibilityByPatientId.get(selectedAppointment.client_id)?.checked_at) ? (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Eligibility has not been checked within 30 days.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => void runEligibilityForSelected()}
                        className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
                      >
                        Run Eligibility
                      </button>
                      {selectedAppointment.client_id ? (
                        <Link href={`/patients/${selectedAppointment.client_id}`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm hover:bg-gray-50">
                          Open Patient Chart
                        </Link>
                      ) : null}
                      <Link href="/encounters/new" className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm hover:bg-gray-50">
                        Create / Open Encounter
                      </Link>
                      <Link href="/billing" className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm hover:bg-gray-50">
                        Route to Biller
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Operational Notes</h2>
                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div>Day view is provider time-grid based.</div>
                  <div>Week view groups appointments by day.</div>
                  <div>Month view shows day cells with stacked appointment chips.</div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
