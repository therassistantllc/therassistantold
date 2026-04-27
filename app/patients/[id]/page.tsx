// File: app/patients/[id]/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { ClientRecord } from "@/lib/types";

interface ProviderRecord {
  id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  credential?: string | null;
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

function ageFromDob(value: string | null | undefined) {
  if (!value) return "—";
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return String(age);
}

function providerLabel(provider: ProviderRecord | null) {
  if (!provider) return "—";
  if (provider.display_name) return provider.display_name;
  const name = [provider.first_name, provider.last_name].filter(Boolean).join(" ");
  if (name && provider.credential) return `${name}, ${provider.credential}`;
  return name || provider.id;
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [provider, setProvider] = useState<ProviderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!patientId) {
        setError("Patient ID is missing.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const patient = data as ClientRecord;
      setClient(patient);

      if (patient.primary_clinician_user_id) {
        const providerResp = await supabase
          .from("providers")
          .select("id, display_name, first_name, last_name, credential")
          .eq("user_id", patient.primary_clinician_user_id)
          .limit(1)
          .maybeSingle();

        if (active && !providerResp.error) {
          setProvider((providerResp.data as ProviderRecord | null) ?? null);
        }
      }

      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [patientId]);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading patient profile...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Could not load patient profile: {error}
        </div>
      ) : !client ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Patient not found.
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="text-sm text-gray-500">Patient Chart</div>
                <h1 className="mt-1 text-3xl font-bold text-gray-900">
                  {[client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed Patient"}
                </h1>
                <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                  <div>DOB: {formatDate(client.date_of_birth)}</div>
                  <div>Age: {ageFromDob(client.date_of_birth)}</div>
                  <div>Patient ID: {client.id}</div>
                  <div>MRN: {client.mrn ?? "—"}</div>
                  <div>Assigned clinician: {providerLabel(provider)}</div>
                  <div>Preferred name: {client.preferred_name ?? "—"}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Link href="/scheduling/new" className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                  Schedule Appointment
                </Link>
                <Link href={`/patients/${client.id}/documents`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                  Create Note
                </Link>
                <Link href={`/patients/${client.id}/documents`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                  Upload Document
                </Link>
                <Link href={`/patients/${client.id}/patient-billing`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
                  View Balance / Statements
                </Link>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <ProfileSection title="Personal Details">
                <div className="grid gap-4 md:grid-cols-2 text-sm text-gray-700">
                  <div><span className="font-medium">Legal first name:</span> {client.first_name ?? "—"}</div>
                  <div><span className="font-medium">Middle name:</span> {client.middle_name ?? "—"}</div>
                  <div><span className="font-medium">Legal last name:</span> {client.last_name ?? "—"}</div>
                  <div><span className="font-medium">Sex at birth:</span> {client.sex_at_birth ?? "—"}</div>
                  <div><span className="font-medium">Gender identity:</span> {client.gender_identity ?? "—"}</div>
                  <div><span className="font-medium">Pronouns:</span> {client.pronouns ?? "—"}</div>
                </div>
              </ProfileSection>

              <ProfileSection title="Contact Information">
                <div className="grid gap-4 md:grid-cols-2 text-sm text-gray-700">
                  <div><span className="font-medium">Phone:</span> {client.phone ?? "—"}</div>
                  <div><span className="font-medium">Email:</span> {client.email ?? "—"}</div>
                  <div><span className="font-medium">Preferred language:</span> {client.preferred_language ?? "—"}</div>
                  <div><span className="font-medium">External client ref:</span> {client.external_client_ref ?? "—"}</div>
                </div>
              </ProfileSection>

              <ProfileSection title="Address">
                <div className="grid gap-4 md:grid-cols-2 text-sm text-gray-700">
                  <div><span className="font-medium">Address line 1:</span> {client.address_line_1 ?? "—"}</div>
                  <div><span className="font-medium">Address line 2:</span> {client.address_line_2 ?? "—"}</div>
                  <div><span className="font-medium">City:</span> {client.city ?? "—"}</div>
                  <div><span className="font-medium">State:</span> {client.state ?? "—"}</div>
                  <div><span className="font-medium">ZIP / postal code:</span> {client.postal_code ?? "—"}</div>
                </div>
              </ProfileSection>
            </div>

            <div className="space-y-6">
              <ProfileSection title="Administrative / Chart Setup">
                <div className="space-y-3 text-sm text-gray-700">
                  <div><span className="font-medium">Assigned clinician:</span> {providerLabel(provider)}</div>
                  <div><span className="font-medium">Primary clinician user ID:</span> {client.primary_clinician_user_id ?? "—"}</div>
                  <div><span className="font-medium">Referral source:</span> —</div>
                  <div><span className="font-medium">Location:</span> —</div>
                  <div><span className="font-medium">Portal status:</span> Not enabled yet</div>
                </div>
              </ProfileSection>

              <ProfileSection title="Guarantor / Emergency Contact">
                <div className="space-y-3 text-sm text-gray-700">
                  <div><span className="font-medium">Emergency contact:</span> —</div>
                  <div><span className="font-medium">Guarantor:</span> Patient</div>
                  <div><span className="font-medium">SSN:</span> —</div>
                </div>
              </ProfileSection>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
