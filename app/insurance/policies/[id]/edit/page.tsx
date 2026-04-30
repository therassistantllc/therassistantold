"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface PolicyForm {
  client_id: string;
  payer_id: string;
  member_id: string;
  group_number: string;
  plan_name: string;
  policy_type: string;
  effective_date: string;
  termination_date: string;
  copay_amount: string;
  deductible_amount: string;
  is_active: boolean;
  notes: string;
}

interface Client {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface Payer {
  id: string;
  name?: string | null;
}

export default function EditInsurancePolicyPage() {
  const params = useParams();
  const policyId = params.id as string;
  const router = useRouter();

  const [form, setForm] = useState<PolicyForm>({
    client_id: "",
    payer_id: "",
    member_id: "",
    group_number: "",
    plan_name: "",
    policy_type: "primary",
    effective_date: "",
    termination_date: "",
    copay_amount: "",
    deductible_amount: "",
    is_active: true,
    notes: "",
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      // Load existing policy data
      const { data: policyData, error: policyError } = await supabase
        .from("insurance_policies")
        .select("*")
        .eq("id", policyId)
        .single();

      if (!active) return;

      if (policyError) {
        setError(policyError.message);
        setLoading(false);
        return;
      }

      if (policyData) {
        setForm({
          client_id: policyData.client_id || "",
          payer_id: policyData.payer_id || "",
          member_id: policyData.member_id || "",
          group_number: policyData.group_number || "",
          plan_name: policyData.plan_name || "",
          policy_type: policyData.policy_type || "primary",
          effective_date: policyData.effective_date || "",
          termination_date: policyData.termination_date || "",
          copay_amount: policyData.copay_amount?.toString() || "",
          deductible_amount: policyData.deductible_amount?.toString() || "",
          is_active: policyData.is_active ?? true,
          notes: policyData.notes || "",
        });
      }

      // Load clients and payers for dropdowns
      const [{ data: clientsData }, { data: payersData }] = await Promise.all([
        supabase.from("clients").select("id, first_name, last_name").is("archived_at", null).order("last_name"),
        supabase.from("payers").select("id, name").is("archived_at", null).order("name"),
      ]);

      if (!active) return;

      setClients((clientsData ?? []) as Client[]);
      setPayers((payersData ?? []) as Payer[]);
      setLoading(false);
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [policyId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!form.client_id || !form.payer_id) {
      setError("Patient and Payer are required.");
      setSaving(false);
      return;
    }

    const updateData: Record<string, any> = {
      client_id: form.client_id,
      payer_id: form.payer_id,
      member_id: form.member_id || null,
      group_number: form.group_number || null,
      plan_name: form.plan_name || null,
      policy_type: form.policy_type,
      effective_date: form.effective_date || null,
      termination_date: form.termination_date || null,
      copay_amount: form.copay_amount ? parseFloat(form.copay_amount) : null,
      deductible_amount: form.deductible_amount ? parseFloat(form.deductible_amount) : null,
      is_active: form.is_active,
      notes: form.notes || null,
    };

    const { error: updateError } = await supabase
      .from("insurance_policies")
      .update(updateData)
      .eq("id", policyId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);

    setTimeout(() => {
      router.push(`/patients/${form.client_id}`);
    }, 800);
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Insurance Policy</h1>
            <p className="mt-2 text-sm text-gray-600">Update the details of this insurance policy.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading policy data...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                  Policy updated successfully! Redirecting...
                </div>
              )}

              <div className="space-y-6">
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Policy Information</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
                        Patient <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="client_id"
                        name="client_id"
                        value={form.client_id}
                        onChange={handleChange}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select patient...</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {[client.first_name, client.last_name].filter(Boolean).join(" ")}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="payer_id" className="block text-sm font-medium text-gray-700">
                        Payer <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="payer_id"
                        name="payer_id"
                        value={form.payer_id}
                        onChange={handleChange}
                        required
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select payer...</option>
                        {payers.map((payer) => (
                          <option key={payer.id} value={payer.id}>
                            {payer.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="member_id" className="block text-sm font-medium text-gray-700">
                        Member ID
                      </label>
                      <input
                        type="text"
                        id="member_id"
                        name="member_id"
                        value={form.member_id}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="group_number" className="block text-sm font-medium text-gray-700">
                        Group Number
                      </label>
                      <input
                        type="text"
                        id="group_number"
                        name="group_number"
                        value={form.group_number}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="plan_name" className="block text-sm font-medium text-gray-700">
                        Plan Name
                      </label>
                      <input
                        type="text"
                        id="plan_name"
                        name="plan_name"
                        value={form.plan_name}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="policy_type" className="block text-sm font-medium text-gray-700">
                        Policy Type
                      </label>
                      <select
                        id="policy_type"
                        name="policy_type"
                        value={form.policy_type}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="tertiary">Tertiary</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Coverage Dates</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="effective_date" className="block text-sm font-medium text-gray-700">
                        Effective Date
                      </label>
                      <input
                        type="date"
                        id="effective_date"
                        name="effective_date"
                        value={form.effective_date}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="termination_date" className="block text-sm font-medium text-gray-700">
                        Termination Date
                      </label>
                      <input
                        type="date"
                        id="termination_date"
                        name="termination_date"
                        value={form.termination_date}
                        onChange={handleChange}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Financial Details</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="copay_amount" className="block text-sm font-medium text-gray-700">
                        Copay Amount
                      </label>
                      <div className="relative mt-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
                        <input
                          type="number"
                          id="copay_amount"
                          name="copay_amount"
                          value={form.copay_amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="deductible_amount" className="block text-sm font-medium text-gray-700">
                        Deductible Amount
                      </label>
                      <div className="relative mt-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
                        <input
                          type="number"
                          id="deductible_amount"
                          name="deductible_amount"
                          value={form.deductible_amount}
                          onChange={handleChange}
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Status &amp; Notes</h2>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        name="is_active"
                        checked={form.is_active}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                        Policy is active
                      </label>
                    </div>

                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        value={form.notes}
                        onChange={handleChange}
                        rows={4}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <Link
                  href={form.client_id ? `/patients/${form.client_id}` : "/insurance/policies"}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving || success}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
