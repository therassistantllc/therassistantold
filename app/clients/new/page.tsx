// File: app/clients/new/page.tsx
"use client";

import { FormEvent, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface ClientFormState {
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  date_of_birth: string;
  sex_at_birth: string;
  gender_identity: string;
  pronouns: string;
  mrn: string;
  phone: string;
  email: string;
  preferred_language: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  external_client_ref: string;
  primary_clinician_user_id: string;
}

const initialState: ClientFormState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  preferred_name: "",
  date_of_birth: "",
  sex_at_birth: "",
  gender_identity: "",
  pronouns: "",
  mrn: "",
  phone: "",
  email: "",
  preferred_language: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  external_client_ref: "",
  primary_clinician_user_id: "",
};

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      {children}
      {hint ? <div className="mt-1 text-xs text-gray-500">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function NewClientPage() {
  const [form, setForm] = useState<ClientFormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const readiness = useMemo(() => {
    const billingCore = [
      form.first_name,
      form.last_name,
      form.date_of_birth,
      form.sex_at_birth,
      form.address_line_1,
      form.city,
      form.state,
      form.postal_code,
    ];
    return billingCore.filter((value) => value.trim().length > 0).length;
  }, [form]);

  function update<K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

   const payload = {
  organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
  ...Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value || null])
  ),
};

    const { data, error: insertError } = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Client created: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Structured Client Intake</h1>
            <p className="mt-2 text-sm text-gray-600">
              Organized for mental health EHR intake and cleaner downstream billing. Client demographics stay here.
              Subscriber and coverage details belong in the insurance policy workflow.
            </p>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">Billing core completeness</div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{readiness}/8</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-500">837P relevance</div>
              <div className="mt-2 text-lg font-semibold text-gray-900">Client demographics only</div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="text-sm font-medium text-amber-800">Insurance reminder</div>
              <div className="mt-2 text-sm text-amber-900">
                Subscriber and policy data should be entered on the separate insurance policy form, not mixed into the client demographic record.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Section
              title="1. Client Identity"
              description="Legal identity and demographic elements that tend to matter most for eligibility and claims."
            >
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Legal first name" required>
                  <input value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Middle name">
                  <input value={form.middle_name} onChange={(e) => update("middle_name", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Legal last name" required>
                  <input value={form.last_name} onChange={(e) => update("last_name", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Preferred name">
                  <input value={form.preferred_name} onChange={(e) => update("preferred_name", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-5">
                <Field label="Date of birth" required>
                  <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Sex at birth" required hint="Often needed for payer matching.">
                  <select value={form.sex_at_birth} onChange={(e) => update("sex_at_birth", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500">
                    <option value="">Select</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Unknown">Unknown</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Gender identity">
                  <input value={form.gender_identity} onChange={(e) => update("gender_identity", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Pronouns">
                  <input value={form.pronouns} onChange={(e) => update("pronouns", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="MRN" hint="Internal client identifier.">
                  <input value={form.mrn} onChange={(e) => update("mrn", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>
            </Section>

            <Section
              title="2. Contact"
              description="How your office reaches the client for reminders, intake, statements, and follow-up."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Email">
                  <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Preferred language">
                  <input value={form.preferred_language} onChange={(e) => update("preferred_language", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>
            </Section>

            <Section
              title="3. Address"
              description="Client mailing address. This is part of the core billing identity set."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Address line 1" required>
                  <input value={form.address_line_1} onChange={(e) => update("address_line_1", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Address line 2">
                  <input value={form.address_line_2} onChange={(e) => update("address_line_2", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label="City" required>
                  <input value={form.city} onChange={(e) => update("city", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="State" required>
                  <input value={form.state} onChange={(e) => update("state", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="ZIP / postal code" required>
                  <input value={form.postal_code} onChange={(e) => update("postal_code", e.target.value)} required className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>
            </Section>

            <Section
              title="4. Administrative Identifiers"
              description="Internal or operational identifiers. Helpful for cross-system matching and staff assignment."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="External client reference">
                  <input value={form.external_client_ref} onChange={(e) => update("external_client_ref", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
                <Field label="Primary clinician user ID">
                  <input value={form.primary_clinician_user_id} onChange={(e) => update("primary_clinician_user_id", e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500" />
                </Field>
              </div>
            </Section>

            <Section
              title="5. Billing Guidance"
              description="These are workflow notes, not saved form fields."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <div className="font-medium">What belongs here</div>
                  <div className="mt-2">
                    Legal client name, DOB, sex at birth, address, contact info, MRN, and operational client identifiers.
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="font-medium">What belongs in insurance</div>
                  <div className="mt-2">
                    Policy number, subscriber ID, payer ID, priority, effective dates, and any subscriber-vs-client relationship details.
                  </div>
                </div>
              </div>
            </Section>

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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Create Client"}
              </button>
              <a
                href="/insurance/policies/new"
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                Next: Insurance Policy
              </a>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
