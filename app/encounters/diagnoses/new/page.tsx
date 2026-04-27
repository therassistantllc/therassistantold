// File: app/encounters/diagnoses/new/page.tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { EncounterRecord } from "@/lib/types";

interface DiagnosisFormState {
  encounter_id: string;
  diagnosis_code: string;
  diagnosis_description: string;
  is_primary: boolean;
  sequence_number: number;
  present_on_claim: boolean;
}

const initialState: DiagnosisFormState = {
  encounter_id: "",
  diagnosis_code: "",
  diagnosis_description: "",
  is_primary: true,
  sequence_number: 1,
  present_on_claim: true,
};

function encounterLabel(encounter: EncounterRecord) {
  return [
    encounter.service_date ?? "No service date",
    encounter.client_id ? `Client ${encounter.client_id}` : "",
    encounter.provider_id ? `Provider ${encounter.provider_id}` : "",
  ].filter(Boolean).join(" • ");
}

export default function NewEncounterDiagnosisPage() {
  const [form, setForm] = useState<DiagnosisFormState>(initialState);
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
    };

    const { data, error: insertError } = await supabase
      .from("encounter_diagnoses")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Diagnosis added: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Connected Diagnosis Form</h1>
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

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={form.diagnosis_code}
                  onChange={(e) => setForm((c) => ({ ...c, diagnosis_code: e.target.value }))}
                  required
                  placeholder="Diagnosis code"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={form.sequence_number}
                  onChange={(e) => setForm((c) => ({ ...c, sequence_number: Number(e.target.value || 1) }))}
                  required
                  placeholder="Sequence number"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                />
              </div>

              <textarea
                value={form.diagnosis_description}
                onChange={(e) => setForm((c) => ({ ...c, diagnosis_description: e.target.value }))}
                rows={3}
                required
                placeholder="Diagnosis description"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <select
                  value={form.is_primary ? "yes" : "no"}
                  onChange={(e) => setForm((c) => ({ ...c, is_primary: e.target.value === "yes" }))}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                >
                  <option value="yes">Primary diagnosis</option>
                  <option value="no">Secondary diagnosis</option>
                </select>
                <select
                  value={form.present_on_claim ? "yes" : "no"}
                  onChange={(e) => setForm((c) => ({ ...c, present_on_claim: e.target.value === "yes" }))}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                >
                  <option value="yes">Present on claim</option>
                  <option value="no">Not on claim</option>
                </select>
              </div>

              {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div> : null}

              <button type="submit" disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Saving..." : "Add Diagnosis"}
              </button>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
