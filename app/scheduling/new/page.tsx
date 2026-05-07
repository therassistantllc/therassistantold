// File: app/scheduling/new/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { ClientRecord, InsurancePolicyRecord } from "@/lib/types";

interface ProviderRecord {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  credential?: string | null;
  is_active?: boolean | null;
  archived_at?: string | null;
}

interface AppointmentFormState {
  client_id: string;
  provider_id: string;
  scheduled_start_at: string;
  duration_minutes: number;
  appointment_type: "Telehealth" | "In-person" | "";
  service_location: "office" | "telehealth";
  reason: "Intake" | "Follow-up" | "";
  recurrence_frequency: "none" | "weekly" | "biweekly" | "monthly";
  recurrence_end_mode: "by_count" | "by_date";
  recurrence_end_date: string;
  recurrence_session_count: number;
  reminder_email_enabled: boolean;
  reminder_sms_enabled: boolean;
  reminder_portal_enabled: boolean;
  reminder_lead_hours: number;
  internal_note: string;
}

const initialState: AppointmentFormState = {
  client_id: "",
  provider_id: "",
  scheduled_start_at: "",
  duration_minutes: 60,
  appointment_type: "",
  service_location: "office",
  reason: "",
  recurrence_frequency: "none",
  recurrence_end_mode: "by_count",
  recurrence_end_date: "",
  recurrence_session_count: 12,
  reminder_email_enabled: true,
  reminder_sms_enabled: false,
  reminder_portal_enabled: true,
  reminder_lead_hours: 24,
  internal_note: "",
};

function buildClientLabel(client: ClientRecord) {
  const name = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.id;
  const extra = [client.preferred_name, client.mrn].filter(Boolean).join(" • ");
  return extra ? `${name} (${extra})` : name;
}

function buildPolicyLabel(policy: InsurancePolicyRecord) {
  const bits = [policy.policy_number, policy.plan_name, policy.priority ? `Priority ${policy.priority}` : ""].filter(Boolean);
  return bits.join(" • ") || policy.id;
}

function buildProviderLabel(provider: ProviderRecord) {
  if (provider.display_name) return provider.display_name;
  const name = [provider.first_name, provider.last_name].filter(Boolean).join(" ");
  if (name && provider.credential) return `${name}, ${provider.credential}`;
  return name || provider.id;
}

function defaultPosForAppointmentType(type: AppointmentFormState["appointment_type"]) {
  if (type === "Telehealth") return "02";
  if (type === "In-person") return "11";
  return "—";
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const [form, setForm] = useState<AppointmentFormState>(initialState);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      setLoading(true);
      setError(null);

      const [clientResp, policyResp, providerResp] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .is("archived_at", null)
          .order("last_name", { ascending: true })
          .limit(200),
        supabase
          .from("insurance_policies")
          .select("*")
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("providers")
          .select("id, display_name, first_name, last_name, credential, is_active, archived_at")
          .eq("is_active", true)
          .is("archived_at", null)
          .order("display_name", { ascending: true })
          .limit(200),
      ]);

      if (!active) return;

      const firstError =
        clientResp.error?.message ||
        policyResp.error?.message ||
        providerResp.error?.message;

      if (firstError) {
        setError(firstError);
        setLoading(false);
        return;
      }

      setClients((clientResp.data ?? []) as ClientRecord[]);
      setPolicies((policyResp.data ?? []) as InsurancePolicyRecord[]);
      setProviders((providerResp.data ?? []) as ProviderRecord[]);
      setLoading(false);
    }

    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  const clientPolicies = useMemo(() => {
    if (!form.client_id) return [];
    return policies.filter((policy) => policy.client_id === form.client_id && !policy.archived_at);
  }, [policies, form.client_id]);

  const selectedPolicy = useMemo(() => clientPolicies[0] ?? null, [clientPolicies]);
  const defaultPos = useMemo(() => defaultPosForAppointmentType(form.appointment_type), [form.appointment_type]);

  async function runAvailabilityCheck() {
    if (!form.provider_id || !form.scheduled_start_at || !form.duration_minutes) return;

    const start = new Date(form.scheduled_start_at);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + Number(form.duration_minutes || 0));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    const response = await fetch("/api/scheduling/availability/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerId: form.provider_id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: form.service_location,
      }),
    });

    const payload = await response.json();

    if (!response.ok || payload.success === false) {
      setAvailabilityHint(payload.error ?? "Availability could not be verified.");
      return;
    }

    if (payload.available) {
      setAvailabilityHint("Provider is available for this slot.");
    } else {
      const reason = Array.isArray(payload.reasons) && payload.reasons.length > 0
        ? payload.reasons.join(" ")
        : "Provider is not available for this slot.";
      setAvailabilityHint(reason);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const start = new Date(form.scheduled_start_at);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + Number(form.duration_minutes || 0));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Start time and duration are required.");
      setSaving(false);
      return;
    }

    if (end <= start) {
      setError("End time must be later than start time.");
      setSaving(false);
      return;
    }

    if (start.getMinutes() % 15 !== 0) {
      setError("Appointments must start on 15-minute boundaries.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/scheduling/appointments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
        clientId: form.client_id,
        providerId: form.provider_id,
        insurancePolicyId: selectedPolicy?.id ?? null,
        scheduledStartAt: form.scheduled_start_at,
        durationMinutes: form.duration_minutes,
        appointmentType: form.appointment_type,
        reason: form.reason,
        serviceLocation: form.service_location,
        internalNote: form.internal_note,
        reminderEmailEnabled: form.reminder_email_enabled,
        reminderSmsEnabled: form.reminder_sms_enabled,
        reminderPortalEnabled: form.reminder_portal_enabled,
        reminderLeadHours: form.reminder_lead_hours,
        recurrence: {
          frequency: form.recurrence_frequency,
          endMode: form.recurrence_end_mode,
          endDate: form.recurrence_end_mode === "by_date" ? form.recurrence_end_date : null,
          sessionCount: form.recurrence_end_mode === "by_count" ? form.recurrence_session_count : null,
        },
      }),
    });

    const payload = await response.json();

    if (!response.ok || payload.success === false) {
      setError(payload.error ?? "Could not create appointment.");
      setSaving(false);
      return;
    }

    const created = Number(payload.occurrencesCreated ?? 0);
    setSuccess(created > 1 ? `Created ${created} recurring appointments.` : `Appointment created.`);
    setSaving(false);
    
    // Redirect to patient chart
    setTimeout(() => {
      router.push(`/patients/${form.client_id}`);
    }, 500);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Scheduling Form with Real Providers</h1>
            <p className="mt-2 text-sm text-gray-600">
              Schedule in one pass with availability checks, recurrence controls, and reminder setup.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading scheduling options...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Client</label>
                  <select
                    value={form.client_id}
                    onChange={(e) => setForm((c) => ({ ...c, client_id: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {buildClientLabel(client)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Provider</label>
                  <select
                    value={form.provider_id}
                    onChange={(e) => setForm((c) => ({ ...c, provider_id: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Select provider</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {buildProviderLabel(provider)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-medium text-blue-900">Derived insurance policy</div>
                <div className="mt-2 text-sm text-blue-900">
                  {selectedPolicy ? buildPolicyLabel(selectedPolicy) : "No active policy found for selected client."}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Start</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_start_at}
                    onChange={(e) => setForm((c) => ({ ...c, scheduled_start_at: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Duration</label>
                  <select
                    value={String(form.duration_minutes)}
                    onChange={(e) => setForm((c) => ({ ...c, duration_minutes: Number(e.target.value) || 60 }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="75">75 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Appointment type</label>
                  <select
                    value={form.appointment_type}
                    onChange={(e) => {
                      const nextType = e.target.value as AppointmentFormState["appointment_type"];
                      setForm((c) => ({
                        ...c,
                        appointment_type: nextType,
                        service_location: nextType === "Telehealth" ? "telehealth" : "office",
                      }));
                    }}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="Telehealth">Telehealth</option>
                    <option value="In-person">In-person</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reason</label>
                  <select
                    value={form.reason}
                    onChange={(e) => setForm((c) => ({ ...c, reason: e.target.value as AppointmentFormState["reason"] }))}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="">Select reason</option>
                    <option value="Intake">Intake</option>
                    <option value="Follow-up">Follow-up</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Service location</label>
                  <select
                    value={form.service_location}
                    onChange={(e) => setForm((c) => ({ ...c, service_location: e.target.value as AppointmentFormState["service_location"] }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="office">Office</option>
                    <option value="telehealth">Telehealth</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Recurrence</label>
                  <select
                    value={form.recurrence_frequency}
                    onChange={(e) => setForm((c) => ({ ...c, recurrence_frequency: e.target.value as AppointmentFormState["recurrence_frequency"] }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="none">No recurrence</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Reminder lead</label>
                  <select
                    value={String(form.reminder_lead_hours)}
                    onChange={(e) => setForm((c) => ({ ...c, reminder_lead_hours: Number(e.target.value) || 24 }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="24">24 hours</option>
                    <option value="48">48 hours</option>
                    <option value="72">72 hours</option>
                  </select>
                </div>
              </div>

              {form.recurrence_frequency !== "none" ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Recurrence end mode</label>
                    <select
                      value={form.recurrence_end_mode}
                      onChange={(e) => setForm((c) => ({ ...c, recurrence_end_mode: e.target.value as AppointmentFormState["recurrence_end_mode"] }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    >
                      <option value="by_count">By number of sessions</option>
                      <option value="by_date">By end date</option>
                    </select>
                  </div>
                  {form.recurrence_end_mode === "by_count" ? (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Sessions</label>
                      <input
                        type="number"
                        min={1}
                        max={260}
                        value={form.recurrence_session_count}
                        onChange={(e) => setForm((c) => ({ ...c, recurrence_session_count: Math.max(1, Number(e.target.value) || 1) }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">End date</label>
                      <input
                        type="date"
                        value={form.recurrence_end_date}
                        onChange={(e) => setForm((c) => ({ ...c, recurrence_end_date: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.reminder_email_enabled}
                    onChange={(e) => setForm((c) => ({ ...c, reminder_email_enabled: e.target.checked }))}
                  />
                  Email reminder
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.reminder_sms_enabled}
                    onChange={(e) => setForm((c) => ({ ...c, reminder_sms_enabled: e.target.checked }))}
                  />
                  SMS reminder
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.reminder_portal_enabled}
                    onChange={(e) => setForm((c) => ({ ...c, reminder_portal_enabled: e.target.checked }))}
                  />
                  Patient portal reminder
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Internal notes (optional)</label>
                <textarea
                  value={form.internal_note}
                  onChange={(e) => setForm((c) => ({ ...c, internal_note: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  placeholder="Administrative details, prep notes, scheduling context"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-sm font-medium text-emerald-900">Claim POS default</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">{defaultPos}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-700">Telehealth mapping</div>
                  <div className="mt-2 text-sm text-gray-900">Telehealth → POS 02</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-700">In-person mapping</div>
                  <div className="mt-2 text-sm text-gray-900">In-person → POS 11</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                New appointments are created with status <span className="font-semibold">Scheduled</span>.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void runAvailabilityCheck()}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Check provider availability
                </button>
                {availabilityHint ? (
                  <span className="text-sm text-slate-600">{availabilityHint}</span>
                ) : null}
              </div>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div> : null}

              <button type="submit" disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Saving..." : "Create Appointment"}
              </button>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
