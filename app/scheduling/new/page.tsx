// File: app/scheduling/new/page.tsx
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  scheduled_end_at: string;
  appointment_status: string;
  appointment_type: "Telehealth" | "In-person" | "";
  reason: "Intake" | "Follow-up" | "";
}

const initialState: AppointmentFormState = {
  client_id: "",
  provider_id: "",
  scheduled_start_at: "",
  scheduled_end_at: "",
  appointment_status: "scheduled",
  appointment_type: "",
  reason: "",
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
  const [form, setForm] = useState<AppointmentFormState>(initialState);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const start = new Date(form.scheduled_start_at);
    const end = new Date(form.scheduled_end_at);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Start and end time are required.");
      setSaving(false);
      return;
    }

    if (end <= start) {
      setError("End time must be later than start time.");
      setSaving(false);
      return;
    }

    const payload = {
      organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
      client_id: form.client_id,
      provider_id: form.provider_id,
      insurance_policy_id: selectedPolicy?.id ?? null,
      scheduled_start_at: form.scheduled_start_at,
      scheduled_end_at: form.scheduled_end_at,
      appointment_status: form.appointment_status,
      appointment_type: form.appointment_type,
      reason: form.reason,
    };

    const { data, error: insertError } = await supabase
      .from("appointments")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Appointment created: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Scheduling Form with Real Providers</h1>
            <p className="mt-2 text-sm text-gray-600">
              Provider selection is now wired to your real providers table, not demo IDs.
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
                  <label className="mb-2 block text-sm font-medium text-gray-700">End</label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_end_at}
                    onChange={(e) => setForm((c) => ({ ...c, scheduled_end_at: e.target.value }))}
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Appointment type</label>
                  <select
                    value={form.appointment_type}
                    onChange={(e) => setForm((c) => ({ ...c, appointment_type: e.target.value as AppointmentFormState["appointment_type"] }))}
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

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={form.appointment_status}
                  onChange={(e) => setForm((c) => ({ ...c, appointment_status: e.target.value }))}
                  className="w-full max-w-xs rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="checked_in">Checked in</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No show</option>
                </select>
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
