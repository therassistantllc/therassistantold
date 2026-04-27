// File: app/encounters/new/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { AppointmentRecord } from "@/lib/types";

interface EncounterFormState {
  appointment_id: string;
  encounter_status: string;
  started_at: string;
  ended_at: string;
  service_date: string;
  required_billing_fields_complete: boolean;
}

const initialState: EncounterFormState = {
  appointment_id: "",
  encounter_status: "in_progress",
  started_at: "",
  ended_at: "",
  service_date: "",
  required_billing_fields_complete: false,
};

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

function appointmentLabel(appointment: AppointmentRecord) {
  return [
    appointment.scheduled_start_at ? formatDateTime(appointment.scheduled_start_at) : "No start",
    appointment.client_id ? `Client ${appointment.client_id}` : "",
    appointment.provider_id ? `Provider ${appointment.provider_id}` : "",
    appointment.appointment_type ? appointment.appointment_type : "",
    appointment.reason ? appointment.reason : "",
  ].filter(Boolean).join(" • ");
}

export default function NewEncounterPage() {
  const [form, setForm] = useState<EncounterFormState>(initialState);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("appointments")
        .select("*")
        .is("archived_at", null)
        .order("scheduled_start_at", { ascending: false })
        .limit(200);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setAppointments((data ?? []) as AppointmentRecord[]);
      setLoading(false);
    }

    void loadAppointments();
    return () => {
      active = false;
    };
  }, []);

  const selectedAppointment = useMemo(
    () => appointments.find((item) => item.id === form.appointment_id) ?? null,
    [appointments, form.appointment_id]
  );

  const encounterPreview = useMemo(() => {
    if (!selectedAppointment) return null;
    return {
      appointmentId: selectedAppointment.id,
      clientId: selectedAppointment.client_id ?? "—",
      providerId: selectedAppointment.provider_id ?? "—",
      type: selectedAppointment.appointment_type ?? "—",
      reason: selectedAppointment.reason ?? "—",
      scheduledStart: selectedAppointment.scheduled_start_at ?? "—",
      scheduledEnd: selectedAppointment.scheduled_end_at ?? "—",
      linkedPolicyId: selectedAppointment.insurance_policy_id ?? "—",
    };
  }, [selectedAppointment]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!selectedAppointment) {
      setError("Select an appointment first.");
      setSaving(false);
      return;
    }

    if (!selectedAppointment.client_id || !selectedAppointment.provider_id) {
      setError("Selected appointment is missing a linked client or provider.");
      setSaving(false);
      return;
    }

    const payload = {
      organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
      appointment_id: selectedAppointment.id,
      client_id: selectedAppointment.client_id,
      provider_id: selectedAppointment.provider_id,
      encounter_status: form.encounter_status,
      started_at: form.started_at || null,
      ended_at: form.ended_at || null,
      service_date: form.service_date,
      required_billing_fields_complete: form.required_billing_fields_complete,
    };

    const { data, error: insertError } = await supabase
      .from("encounters")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Encounter created: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Connected Encounter Testing</h1>
            <p className="mt-2 text-sm text-gray-600">
              Select a real appointment, verify linked client/provider values, then create the encounter.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading appointments...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">1. Select Appointment</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Encounter client and provider will be copied from the selected appointment.
                  </p>
                </div>

                <label className="mb-2 block text-sm font-medium text-gray-700">Appointment</label>
                <select
                  value={form.appointment_id}
                  onChange={(e) => setForm((c) => ({ ...c, appointment_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Select appointment</option>
                  {appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {appointmentLabel(appointment)}
                    </option>
                  ))}
                </select>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">2. Linked Record Preview</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Confirm the appointment-derived values before saving the encounter.
                  </p>
                </div>

                {encounterPreview ? (
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm font-medium text-blue-900">Client</div>
                      <div className="mt-2 font-mono text-xs text-blue-900">{encounterPreview.clientId}</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm font-medium text-blue-900">Provider</div>
                      <div className="mt-2 font-mono text-xs text-blue-900">{encounterPreview.providerId}</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm font-medium text-blue-900">Appointment type</div>
                      <div className="mt-2 text-sm text-blue-900">{encounterPreview.type}</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="text-sm font-medium text-blue-900">Reason</div>
                      <div className="mt-2 text-sm text-blue-900">{encounterPreview.reason}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-700">Scheduled start</div>
                      <div className="mt-2 text-sm text-gray-900">{formatDateTime(encounterPreview.scheduledStart)}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-700">Scheduled end</div>
                      <div className="mt-2 text-sm text-gray-900">{formatDateTime(encounterPreview.scheduledEnd)}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-700">Linked policy</div>
                      <div className="mt-2 font-mono text-xs text-gray-900">{encounterPreview.linkedPolicyId}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-sm font-medium text-gray-700">Appointment ID</div>
                      <div className="mt-2 font-mono text-xs text-gray-900">{encounterPreview.appointmentId}</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                    Select an appointment to preview the linked encounter data.
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">3. Encounter Details</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Add encounter-specific timing and billing readiness.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Service date</label>
                    <input
                      type="date"
                      value={form.service_date}
                      onChange={(e) => setForm((c) => ({ ...c, service_date: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Started</label>
                    <input
                      type="datetime-local"
                      value={form.started_at}
                      onChange={(e) => setForm((c) => ({ ...c, started_at: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Ended</label>
                    <input
                      type="datetime-local"
                      value={form.ended_at}
                      onChange={(e) => setForm((c) => ({ ...c, ended_at: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={form.encounter_status}
                      onChange={(e) => setForm((c) => ({ ...c, encounter_status: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In progress</option>
                      <option value="ready_for_billing">Ready for billing</option>
                      <option value="completed">Completed</option>
                      <option value="signed">Signed</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Billing fields complete</label>
                  <select
                    value={form.required_billing_fields_complete ? "yes" : "no"}
                    onChange={(e) => setForm((c) => ({ ...c, required_billing_fields_complete: e.target.value === "yes" }))}
                    className="w-full max-w-xs rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </section>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create Encounter"}
              </button>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
