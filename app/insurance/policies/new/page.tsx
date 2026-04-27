// File: app/insurance/policies/new/page.tsx
"use client";

import { FormEvent, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface PolicyFormState {
  client_id: string;
  payer_id: string;
  policy_number: string;
  subscriber_id: string;
  priority: string;
  plan_name: string;
  effective_date: string;
  termination_date: string;
  active_flag: boolean;
}

const initialState: PolicyFormState = {
  client_id: "",
  payer_id: "",
  policy_number: "",
  subscriber_id: "",
  priority: "1",
  plan_name: "",
  effective_date: "",
  termination_date: "",
  active_flag: true,
};

export default function NewInsurancePolicyPage() {
  const [form, setForm] = useState<PolicyFormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      organization_id: process.env.NEXT_PUBLIC_ORGANIZATION_ID ?? null,
      ...form,
      payer_id: form.payer_id || null,
      subscriber_id: form.subscriber_id || null,
      plan_name: form.plan_name || null,
      effective_date: form.effective_date || null,
      termination_date: form.termination_date || null,
    };

    const { data, error: insertError } = await supabase
      .from("insurance_policies")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess(`Insurance policy created: ${data.id}`);
    setForm(initialState);
    setSaving(false);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">New Insurance Policy</h1>
            <p className="mt-2 text-sm text-gray-600">Organization ID now propagates automatically on save.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <input value={form.client_id} onChange={(e) => setForm((c) => ({ ...c, client_id: e.target.value }))} required placeholder="Client ID" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input value={form.payer_id} onChange={(e) => setForm((c) => ({ ...c, payer_id: e.target.value }))} placeholder="Payer ID" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <input value={form.policy_number} onChange={(e) => setForm((c) => ({ ...c, policy_number: e.target.value }))} required placeholder="Policy number" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input value={form.subscriber_id} onChange={(e) => setForm((c) => ({ ...c, subscriber_id: e.target.value }))} placeholder="Subscriber ID" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input value={form.priority} onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))} placeholder="Priority" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <input value={form.plan_name} onChange={(e) => setForm((c) => ({ ...c, plan_name: e.target.value }))} placeholder="Plan name" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input type="date" value={form.effective_date} onChange={(e) => setForm((c) => ({ ...c, effective_date: e.target.value }))} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
              <input type="date" value={form.termination_date} onChange={(e) => setForm((c) => ({ ...c, termination_date: e.target.value }))} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm" />
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {success && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}

            <button type="submit" disabled={saving} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {saving ? "Saving..." : "Create Insurance Policy"}
            </button>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
