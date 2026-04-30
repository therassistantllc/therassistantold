"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface Payer {
  id: string;
  name?: string | null;
  payer_id?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface Policy {
  id: string;
  client_id?: string | null;
  member_id?: string | null;
  group_number?: string | null;
  plan_name?: string | null;
  is_active?: boolean;
  effective_date?: string | null;
  termination_date?: string | null;
}

interface Patient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  mrn?: string | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function PayerDetailPage() {
  const params = useParams();
  const payerId = params.id as string;

  const [payer, setPayer] = useState<Payer | null>(null);
  const [policies, setPolicies] = useState<(Policy & { patient?: Patient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPayerData() {
      setLoading(true);
      setError(null);

      // Load payer details
      const { data: payerData, error: payerError } = await supabase
        .from("payers")
        .select("*")
        .eq("id", payerId)
        .single();

      if (!active) return;

      if (payerError) {
        setError(payerError.message);
        setLoading(false);
        return;
      }

      setPayer(payerData as Payer);

      // Load policies associated with this payer
      const { data: policiesData, error: policiesError } = await supabase
        .from("insurance_policies")
        .select("*")
        .eq("payer_id", payerId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (policiesError) {
        console.error("Error loading policies:", policiesError);
        setPolicies([]);
      } else {
        const policies = (policiesData ?? []) as Policy[];
        const patientIds = Array.from(new Set(policies.map((p) => p.client_id).filter(Boolean) as string[]));

        if (patientIds.length > 0) {
          const { data: patientsData } = await supabase
            .from("clients")
            .select("id, first_name, last_name, mrn")
            .in("id", patientIds);

          const patientById = new Map((patientsData ?? []).map((p: Patient) => [p.id, p]));
          setPolicies(policies.map((policy) => ({
            ...policy,
            patient: policy.client_id ? patientById.get(policy.client_id) : undefined,
          })));
        } else {
          setPolicies(policies);
        }
      }

      setLoading(false);
    }

    void loadPayerData();

    return () => {
      active = false;
    };
  }, [payerId]);

  const activePolicies = policies.filter((p) => p.is_active);
  const inactivePolicies = policies.filter((p) => !p.is_active);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading payer details...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Error loading payer: {error}
            </div>
          ) : !payer ? (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-700 shadow-sm">
              Payer not found.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{payer.name || "Unnamed Payer"}</h1>
                  {payer.payer_id && (
                    <p className="mt-1 text-sm text-gray-600">Payer ID: {payer.payer_id}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  disabled
                >
                  Edit Payer
                </button>
              </div>

              <section className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-gray-500">Address</dt>
                      <dd className="text-gray-900">
                        {payer.address_line1 || payer.address_line2 || payer.city || payer.state || payer.zip_code ? (
                          <>
                            {payer.address_line1 && <div>{payer.address_line1}</div>}
                            {payer.address_line2 && <div>{payer.address_line2}</div>}
                            <div>
                              {[payer.city, payer.state, payer.zip_code].filter(Boolean).join(", ")}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Phone</dt>
                      <dd className="text-gray-900">{payer.phone || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Fax</dt>
                      <dd className="text-gray-900">{payer.fax || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Email</dt>
                      <dd className="text-gray-900">
                        {payer.email ? (
                          <a href={`mailto:${payer.email}`} className="text-blue-600 hover:underline">
                            {payer.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Website</dt>
                      <dd className="text-gray-900">
                        {payer.website ? (
                          <a
                            href={payer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {payer.website}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Statistics</h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm text-gray-500">Active Policies</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">{activePolicies.length}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Inactive Policies</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-600">{inactivePolicies.length}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Total Policies</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">{policies.length}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              {payer.notes && (
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-2 text-lg font-semibold text-gray-900">Notes</h2>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{payer.notes}</p>
                </section>
              )}

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Associated Policies</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Patient</th>
                        <th className="px-4 py-3">Member ID</th>
                        <th className="px-4 py-3">Group Number</th>
                        <th className="px-4 py-3">Plan Name</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Effective Date</th>
                        <th className="px-4 py-3">Termination Date</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {policies.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                            No policies found for this payer.
                          </td>
                        </tr>
                      ) : (
                        policies.map((policy) => (
                          <tr key={policy.id} className="text-sm text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {policy.patient ? (
                                <Link
                                  href={`/patients/${policy.client_id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {[policy.patient.first_name, policy.patient.last_name].filter(Boolean).join(" ")}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{policy.member_id || "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs">{policy.group_number || "—"}</td>
                            <td className="px-4 py-3">{policy.plan_name || "—"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                                  policy.is_active
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {policy.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">{formatDate(policy.effective_date)}</td>
                            <td className="px-4 py-3">{formatDate(policy.termination_date)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/insurance/policies/${policy.id}/edit`}
                                className="text-blue-600 hover:underline"
                              >
                                Edit
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
