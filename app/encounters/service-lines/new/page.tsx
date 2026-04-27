// File: app/encounters/service-lines/new/page.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterRecord } from "@/lib/types";

interface ServiceLineFormState {
  encounter_id: string;
  service_date: string;
  sequence_number: string;
  cpt_hcpcs_code: string;
  modifier_1: string;
  modifier_2: string;
  modifier_3: string;
  modifier_4: string;
  units: string;
  charge_amount: string;
  place_of_service_code: string;
  rendering_provider_id: string;
}

const initialState: ServiceLineFormState = {
  encounter_id: "",
  service_date: "",
  sequence_number: "1",
  cpt_hcpcs_code: "",
  modifier_1: "",
  modifier_2: "",
  modifier_3: "",
  modifier_4: "",
  units: "1",
  charge_amount: "",
  place_of_service_code: "",
  rendering_provider_id: "",
};

function encounterLabel(encounter: EncounterRecord) {
  return [
    encounter.service_date ?? "No service date",
    encounter.client_id ? `Client ${encounter.client_id}` : "",
    encounter.provider_id ? `Provider ${encounter.provider_id}` : "",
  ].filter(Boolean).join(" • ");
}

export default function NewEncounterServiceLinePage() {
  const [form, setForm] = useState<ServiceLineFormState>(initialState);
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEncounters() {
      const { data, error: queryError } = await supabase
        .from("encounters")
        .select("*")
        .is("archived_at", null)
        .order("service_date", { ascending: false })
        .limit(200);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setEncounters((data ?? []) as EncounterRecord[]);
      setLoading(false);
    }

    void loadEncounters();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
      ...form,
      modifier_1: form.modifier_1 || null,
      modifier_2: form.modifier_2 || null,
      modifier_3: form.modifier_3 || null,
      modifier_4: form.modifier_4 || null,
      rendering_provider_id: form.rendering_provider_id || null,
      sequence_number: Number(form.sequence_number || 1),
    };

    const { data, error: insertError } = await supabase
      .from("encounter_service_lines")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Service line added: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Connected Service Line Form</h1>
            <p className="mt-2 text-sm text-gray-600">Pick an encounter instead of typing a UUID.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading encounters...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Encounter</label>
                <select
                  value={form.encounter_id}
                  onChange={(e) => setForm((c) => ({ ...c, encounter_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                >
                  <option value="">Select encounter</option>
                  {encounters.map((encounter) => (
                    <option key={encounter.id} value={encounter.id}>
                      {encounterLabel(encounter)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  type="date"
                  value={form.service_date}
                  onChange={(e) => setForm((c) => ({ ...c, service_date: e.target.value }))}
                  required
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                />
                <input
                  value={form.sequence_number}
                  onChange={(e) => setForm((c) => ({ ...c, sequence_number: e.target.value }))}
                  required
                  placeholder="Sequence number"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                />
                <input
                  value={form.rendering_provider_id}
                  onChange={(e) => setForm((c) => ({ ...c, rendering_provider_id: e.target.value }))}
                  placeholder="Rendering provider ID"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <input value={form.cpt_hcpcs_code} onChange={(e) => setForm((c) => ({ ...c, cpt_hcpcs_code: e.target.value }))} required placeholder="CPT / HCPCS" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.units} onChange={(e) => setForm((c) => ({ ...c, units: e.target.value }))} required placeholder="Units" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.charge_amount} onChange={(e) => setForm((c) => ({ ...c, charge_amount: e.target.value }))} required placeholder="Charge amount" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.place_of_service_code} onChange={(e) => setForm((c) => ({ ...c, place_of_service_code: e.target.value }))} required placeholder="POS" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <input value={form.modifier_1} onChange={(e) => setForm((c) => ({ ...c, modifier_1: e.target.value }))} placeholder="Modifier 1" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.modifier_2} onChange={(e) => setForm((c) => ({ ...c, modifier_2: e.target.value }))} placeholder="Modifier 2" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.modifier_3} onChange={(e) => setForm((c) => ({ ...c, modifier_3: e.target.value }))} placeholder="Modifier 3" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
                <input value={form.modifier_4} onChange={(e) => setForm((c) => ({ ...c, modifier_4: e.target.value }))} placeholder="Modifier 4" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              </div>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div> : null}

              <button type="submit" disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Saving..." : "Add Service Line"}
              </button>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
