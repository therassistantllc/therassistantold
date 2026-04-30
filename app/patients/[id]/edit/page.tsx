"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface PatientFormState {
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  date_of_birth: string;
  pronouns: string;
  sex_at_birth: string;
  gender_identity: string;
  preferred_language: string;
  email: string;
  phone: string;
  mrn: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
}

export default function PatientEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [form, setForm] = useState<PatientFormState>({
    first_name: "",
    middle_name: "",
    last_name: "",
    preferred_name: "",
    date_of_birth: "",
    pronouns: "",
    sex_at_birth: "",
    gender_identity: "",
    preferred_language: "",
    email: "",
    phone: "",
    mrn: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    postal_code: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;

    let active = true;

    async function loadPatient() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setForm({
          first_name: data.first_name || "",
          middle_name: data.middle_name || "",
          last_name: data.last_name || "",
          preferred_name: data.preferred_name || "",
          date_of_birth: data.date_of_birth || "",
          pronouns: data.pronouns || "",
          sex_at_birth: data.sex_at_birth || "",
          gender_identity: data.gender_identity || "",
          preferred_language: data.preferred_language || "",
          email: data.email || "",
          phone: data.phone || "",
          mrn: data.mrn || "",
          address_line_1: data.address_line_1 || "",
          address_line_2: data.address_line_2 || "",
          city: data.city || "",
          state: data.state || "",
          postal_code: data.postal_code || "",
        });
      }

      setLoading(false);
    }

    void loadPatient();

    return () => {
      active = false;
    };
  }, [patientId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("clients")
      .update({
        ...form,
        updated_at: new Date().toISOString(),
      })
      .eq("id", patientId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess("Patient information updated successfully");
    setSaving(false);

    setTimeout(() => {
      router.push(`/patients/${patientId}`);
    }, 1000);
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Patient Demographics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Update patient demographic and contact information.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading patient information...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Personal Information</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">First Name *</label>
                    <input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => setForm((c) => ({ ...c, first_name: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Middle Name</label>
                    <input
                      type="text"
                      value={form.middle_name}
                      onChange={(e) => setForm((c) => ({ ...c, middle_name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Last Name *</label>
                    <input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => setForm((c) => ({ ...c, last_name: e.target.value }))}
                      required
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Preferred Name</label>
                    <input
                      type="text"
                      value={form.preferred_name}
                      onChange={(e) => setForm((c) => ({ ...c, preferred_name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Date of Birth</label>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm((c) => ({ ...c, date_of_birth: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">MRN</label>
                    <input
                      type="text"
                      value={form.mrn}
                      onChange={(e) => setForm((c) => ({ ...c, mrn: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Pronouns</label>
                    <input
                      type="text"
                      value={form.pronouns}
                      onChange={(e) => setForm((c) => ({ ...c, pronouns: e.target.value }))}
                      placeholder="e.g., they/them, she/her, he/him"
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Sex at Birth</label>
                    <select
                      value={form.sex_at_birth}
                      onChange={(e) => setForm((c) => ({ ...c, sex_at_birth: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Gender Identity</label>
                    <input
                      type="text"
                      value={form.gender_identity}
                      onChange={(e) => setForm((c) => ({ ...c, gender_identity: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Preferred Language</label>
                    <input
                      type="text"
                      value={form.preferred_language}
                      onChange={(e) => setForm((c) => ({ ...c, preferred_language: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Address</h2>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 1</label>
                    <input
                      type="text"
                      value={form.address_line_1}
                      onChange={(e) => setForm((c) => ({ ...c, address_line_1: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Address Line 2</label>
                    <input
                      type="text"
                      value={form.address_line_2}
                      onChange={(e) => setForm((c) => ({ ...c, address_line_2: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">City</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">State</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => setForm((c) => ({ ...c, state: e.target.value }))}
                        placeholder="e.g., CA"
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Postal Code</label>
                      <input
                        type="text"
                        value={form.postal_code}
                        onChange={(e) => setForm((c) => ({ ...c, postal_code: e.target.value }))}
                        className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <Link
                  href={`/patients/${patientId}`}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </AppShell>
  );
}
