// app/patients/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

type EncounterRow = {
  id: string;
  client_id: string;
  title: string | null;
  note: string | null;
  service_code: string | null;
  rendered_at: string | null;
  start_time: string | null;
  end_time: string | null;
  provider_id: string | null;
  created_at: string | null;
};

type ProviderRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type InsurancePolicyRow = {
  id: string;
  payer_name: string | null;
  member_id: string | null;
  status: string | null;
  updated_at: string | null;
  balance: number | null;
};

type ClaimRow = {
  id: string;
  claim_status: string | null;
  total_charge_amount: number | null;
  patient_responsibility_amount: number | null;
  insurance_balance: number | null;
  created_at: string | null;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  gender_identity: string | null;
  mobile_phone: string | null;
  home_phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  assigned_provider_id: string | null;
  status: string | null;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateShortLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  })
    .format(date)
    .toUpperCase();
}

function formatDateTimeRange(start: string | null | undefined, end: string | null | undefined) {
  const format = (input: string | null | undefined) => {
    if (!input) {
      return null;
    }

    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  const startLabel = format(start);
  const endLabel = format(end);

  if (startLabel && endLabel) {
    return `${startLabel} – ${endLabel}`;
  }

  return startLabel ?? endLabel ?? "—";
}

function calculateAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) {
    return null;
  }

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasNotHadBirthdayYet =- dob.getFullYear();
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatAddress(client: ClientRow) {
  const line1 = client.address_line_1 ?? "";
  const line2 = client.address_line_2 ?? "";
  const cityStateZip = [client.city, client.state, client.postal_code].filter(Boolean).join(", ").replace(", ,", ",");

  return [line1, line2, cityStateZip].filter(Boolean).join("\n") || "—";
}

function providerDisplayName(provider: ProviderRow | null) {
  if (!provider) {
    return "Unassigned";
  }

  if (provider.full_name) {
    return provider.full_name;
  }

  const combined = [provider.first_name, provider.last_name].filter(Boolean).join(" ");
  return combined || "Unassigned";
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function getEncounterPreview(note: string | null | undefined) {
  if (!note) {
    return "No chart note recorded.";
  }

  const trimmed = note.trim();
  if (trimmed.length <= 260) {
    return trimmed;
  }

  return `${trimmed.slice(0, 260).trimEnd()}…`;
}

function getStatusTone(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "active") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }

  if (normalized === "inactive") {
    return "bg-slate-100 text-slate-700 ring-slate-200";
  }

  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function getClaimCounts(claims: ClaimRow[]) {
  return claims.reduce(
    (acc, claim) => {
      const normalized = (claim.claim_status ?? "").toLowerCase();

      if (normalized.includes("paid")) {
        acc.paid += 1;
      } else if (normalized.includes("denied") || normalized.includes("rejected")) {
        acc.denied += 1;
      } else {
        acc.open += 1;
      }

      return acc;
    },
    { paid: 0, denied: 0, open: 0 },
  );
}

function SidebarCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action ? (
          <button className="text-xs font-medium text-blue-600 hover:text-blue-700">{action}</button>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function PatientOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: patient, error: patientError } = await supabase
    .from("clients")
    .select(
      [
        "id",
        "first_name",
        "last_name",
        "preferred_name",
        "date_of_birth",
        "sex",
        "gender_identity",
        "mobile_phone",
        "home_phone",
        "email",
        "address_line_1",
        "address_line_2",
        "city",
        "state",
        "postal_code",
        "assigned_provider_id",
        "status",
      ].join(","),
    )
    .eq("id", id)
    .maybeSingle<ClientRow>();

  if (patientError || !patient) {
    notFound();
  }

  const [
    providerResult,
    encountersResult,
    insuranceResult,
    claimsResult,
  ] = await Promise.all([
    patient.assigned_provider_id
      ? supabase
          .from("providers")
          .select("id, full_name, first_name, last_name")
          .eq("id", patient.assigned_provider_id)
          .maybeSingle<ProviderRow>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("encounters")
      .select(
        [
          "id",
          "client_id",
          "title",
          "note",
          "service_code",
          "rendered_at",
          "start_time",
          "end_time",
          "provider_id",
          "created_at",
        ].join(","),
      )
      .eq("client_id", id)
      .order("rendered_at", { ascending: false })
      .limit(12),
    supabase
      .from("insurance_policies")
      .select("id, payer_name, member_id, status, updated_at, balance")
      .eq("client_id", id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<InsurancePolicyRow>(),
    supabase
      .from("claims")
      .select("id, claim_status, total_charge_amount, patient_responsibility_amount, insurance_balance, created_at")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const provider = providerResult.data ?? null;
  const encounters = (encountersResult.data ?? []) as EncounterRow[];
  const insurance = insuranceResult.data ?? null;
  const claims = (claimsResult.data ?? []) as ClaimRow[];

  const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(" ") || "Unknown Patient";
  const displayName = firstNonEmpty(patient.preferred_name, patientName) ?? patientName;
  const age = calculateAge(patient.date_of_birth);
  const ageGroup = age !== null && age < 18 ? "Minor" : "Adult";
  const claimCounts = getClaimCounts(claims);

  const totalCharges = claims.reduce((sum, claim) => sum + (claim.total_charge_amount ?? 0), 0);
  const totalPatientBalance = claims.reduce((sum, claim) => sum + (claim.patient_responsibility_amount ?? 0), 0);
  const totalInsuranceBalance = claims.reduce((sum, claim) => sum + (claim.insurance_balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link className="hover:text-slate-700" href="/patients">
              Patients
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-slate-700">{displayName}</li>
        </ol>
      </nav>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {displayName}
              </h1>
              {patient.preferred_name && patient.preferred_name !== patientName ? (
                <span className="text-sm text-slate-500">({patientName})</span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200">
                {ageGroup}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium ring-1",
                  getStatusTone(patient.status),
                )}
              >
                {patient.status ?? "Unknown"}
              </span>
              <span className="text-slate-600">{firstNonEmpty(patient.mobile_phone, patient.home_phone) ?? "No phone"}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600">
                DOB {formatDate(patient.date_of_birth)}
                {age !== null ? ` (${age})` : ""}
              </span>
              <Link href={`/patients/${id}`} className="text-blue-600 hover:text-blue-700">
                Edit
              </Link>
            </div>

            {encounters.length === 0 ? (
              <div className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200">
                No chart activity or appointments found yet.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Send Referrals
            </button>
            <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Share
            </button>
            <Link
              href={`/patients/${id}/documents`}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upload
            </Link>
            <button
              aria-label="More actions"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              •••
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold">B</span>
                <span className="font-semibold italic">I</span>
                <span className="line-through">S</span>
                <span>≣</span>
                <span>≡</span>
                <span>↶</span>
                <span>↷</span>
                <span>🔗</span>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <textarea
                aria-label="Add chart note"
                className="min-h-32 w-full resize-y border-0 p-0 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Add Chart Note: include notes from a call with a client or copy & paste the contents of a document or email."
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Chart note date"
                  defaultValue={formatDate(new Date().toISOString())}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
                <input
                  aria-label="Chart note time"
                  defaultValue={new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date())}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
                />
              </div>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Add Note
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  All Time
                </button>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  All Items
                </button>
              </div>

              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                New
              </button>
            </div>

            <div className="px-4 py-5 sm:px-5">
              {encounters.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <h2 className="text-base font-semibold text-slate-900">No chart activity yet</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Encounter notes will appear here once services are documented.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {encounters.map((encounter) => (
                    <article
                      key={encounter.id}
                      className="grid gap-4 border-b border-slate-200 pb-6 last:border-b-0 last:pb-0 sm:grid-cols-[64px_minmax(0,1fr)]"
                    >
                      <div className="pt-1">
                        <div className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-100 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                          {formatDateShortLabel(encounter.rendered_at ?? encounter.created_at)}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                              {firstNonEmpty(encounter.title, "Encounter")}
                            </h2>
                            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                              With: {providerDisplayName(provider)}
                              {encounter.service_code ? (
                                <span className="ml-3">Billing code: {encounter.service_code}</span>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-sm text-slate-500">
                            {formatDateTimeRange(encounter.start_time, encounter.end_time)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                            Chart Note
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {getEncounterPreview(encounter.note)}
                          </p>
                          <Link
                            href={`/patients/${id}/documents`}
                            className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            View full note
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <SidebarCard title="Client billing">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Client balance</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totalPatientBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Insurance balance</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totalInsuranceBalance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Total charges</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totalCharges)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <div className="text-lg font-semibold text-slate-900">{claimCounts.open}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Open</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <div className="text-lg font-semibold text-slate-900">{claimCounts.paid}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Paid</div>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-3">
                  <div className="text-lg font-semibold text-slate-900">{claimCounts.denied}</div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">Denied</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link href={`/patients/${id}/patient-billing`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  View billing workspace
                </Link>
                <button className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Add Payment
                </button>
              </div>
            </div>
          </SidebarCard>

          <SidebarCard title="Insurance" action="Edit">
            {insurance ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{insurance.payer_name ?? "Unknown payer"}</div>
                    <div className="mt-1 text-slate-500">Member ID: {insurance.member_id ?? "—"}</div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                      getStatusTone(insurance.status),
                    )}
                  >
                    {insurance.status ?? "Unknown"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Last updated</span>
                  <span className="text-slate-900">{formatDate(insurance.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Insurance balance</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(insurance.balance)}</span>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href={`/patients/${id}/billing-settings`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Request status check
                  </Link>
                  <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Add insurance payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-slate-600">No insurance policy found for this patient.</p>
                <Link
                  href={`/patients/${id}/billing-settings`}
                  className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Open billing settings
                </Link>
              </div>
            )}
          </SidebarCard>

          <SidebarCard title="Client info" action="Edit">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Sex</dt>
                <dd className="text-right text-slate-900">{patient.sex ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Gender</dt>
                <dd className="text-right text-slate-900">{patient.gender_identity ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Phone</dt>
                <dd className="text-right text-slate-900">
                  {firstNonEmpty(patient.mobile_phone, patient.home_phone) ?? "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Email</dt>
                <dd className="break-all text-right text-slate-900">{patient.email ?? "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Address</dt>
                <dd className="whitespace-pre-line text-right text-slate-900">{formatAddress(patient)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Provider</dt>
                <dd className="text-right text-slate-900">{providerDisplayName(provider)}</dd>
              </div>
            </dl>
          </SidebarCard>

          <SidebarCard title="Contacts">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              No emergency or support contacts available.
            </div>
          </SidebarCard>
        </aside>
      </div>
    </div>
  );
}