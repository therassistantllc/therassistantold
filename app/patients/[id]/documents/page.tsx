// app/patients/[id]/documents/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    q?: string;
    type?: string;
    status?: string;
  }>;
};

type ClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
};

type EncounterRow = {
  id: string;
  client_id: string;
  title: string | null;
  note: string | null;
  rendered_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  service_code: string | null;
  signed_at: string | null;
  locked_at: string | null;
};

type FileStatus = "Uploaded" | "Pending" | "Completed";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
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
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(date);
}

function deriveFileType(encounter: EncounterRow) {
  const title = (encounter.title ?? "").toLowerCase();
  const note = (encounter.note ?? "").toLowerCase();
  const serviceCode = (encounter.service_code ?? "").toLowerCase();
  const combined = `${title} ${note} ${serviceCode}`;

  if (combined.includes("consent") || combined.includes("roi") || combined.includes("release")) {
    return "Consent";
  }

  if (combined.includes("questionnaire") || combined.includes("assessment") || combined.includes("screen")) {
    return "Questionnaire";
  }

  if (combined.includes("intake")) {
    return "Intake";
  }

  if (combined.includes("upload") || combined.includes("attachment") || combined.includes("import")) {
    return "Practice upload";
  }

  return "Chart note";
}

function deriveStatus(encounter: EncounterRow): FileStatus {
  if (encounter.signed_at || encounter.locked_at) {
    return "Completed";
  }

  if (encounter.note && encounter.note.trim().length > 0) {
    return "Uploaded";
  }

  return "Pending";
}

function deriveDisplayName(encounter: EncounterRow) {
  return (
    firstNonEmpty(encounter.title, encounter.service_code && `Encounter ${encounter.service_code}`) ??
    `Encounter ${encounter.id.slice(0, 8)}`
  );
}

function deriveOwnerInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "PT";
}

function getStatusClasses(status: FileStatus) {
  switch (status) {
    case "Completed":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Pending":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    default:
      return "bg-blue-50 text-blue-700 ring-blue-200";
  }
}

function buildQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : "";
}

export default async function PatientDocumentsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim() ?? "";
  const selectedType = resolvedSearchParams.type?.trim() ?? "";
  const selectedStatus = resolvedSearchParams.status?.trim() ?? "";

  const supabase = createServerSupabaseAdminClient();

  if (!supabase) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">Supabase Server Client Is Not Configured</h1>
        <p className="text-sm">
          This route requires server-side Supabase environment variables. Set <strong>NEXT_PUBLIC_SUPABASE_URL</strong>{" "}
          and <strong>SUPABASE_SERVICE_ROLE_KEY</strong> in your environment, then restart the dev server.
        </p>
      </div>
    );
  }

  const [{ data: patient, error: patientError }, { data: encounters, error: encountersError }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, first_name, last_name, preferred_name")
      .eq("id", id)
      .maybeSingle<ClientRow>(),
    supabase
      .from("encounters")
      .select(
        [
          "id",
          "client_id",
          "title",
          "note",
          "rendered_at",
          "created_at",
          "updated_at",
          "service_code",
          "signed_at",
          "locked_at",
        ].join(","),
      )
      .eq("client_id", id)
      .order("updated_at", { ascending: false })
      .limit(200)
      .returns<EncounterRow[]>(),
  ]);

  if (patientError) {
    return (
      <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Could Not Load Patient Documents</h1>
        <p className="text-sm">{patientError.message}</p>
      </div>
    );
  }

  if (!patient) {
    notFound();
  }

  if (encountersError) {
    throw new Error(encountersError.message);
  }

  const patientName =
    firstNonEmpty(patient.preferred_name, [patient.first_name, patient.last_name].filter(Boolean).join(" ")) ??
    "this patient";

  const encounterRows: EncounterRow[] = encounters ?? [];

  const rows = encounterRows.map((encounter) => {
    const name = deriveDisplayName(encounter);
    const type = deriveFileType(encounter);
    const status = deriveStatus(encounter);
    const updatedAt = encounter.updated_at ?? encounter.rendered_at ?? encounter.created_at;

    return {
      id: encounter.id,
      name,
      type,
      status,
      updatedAt,
      ownerInitials: deriveOwnerInitials(patientName),
    };
  });

  const typeOptions = Array.from(new Set(rows.map((row) => row.type))).sort();
  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      query.length === 0 ||
      row.name.toLowerCase().includes(query.toLowerCase()) ||
      row.type.toLowerCase().includes(query.toLowerCase());

    const matchesType = selectedType.length === 0 || row.type === selectedType;
    const matchesStatus = selectedStatus.length === 0 || row.status === selectedStatus;

    return matchesQuery && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Files</h1>
              <p className="mt-1 text-sm text-slate-600">
                Uploaded documents, chart notes, and encounter-backed records for {patientName}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/patients/${id}`}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to overview
              </Link>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Actions
              </button>
            </div>
          </div>

          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <label className="block">
              <span className="sr-only">Search files</span>
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search files"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="sr-only">Filter by type</span>
              <select
                name="type"
                defaultValue={selectedType}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">All file types</option>
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="sr-only">Filter by status</span>
              <select
                name="status"
                defaultValue={selectedStatus}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">All statuses</option>
                <option value="Uploaded">Uploaded</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                Apply
              </button>
              <Link
                href={`/patients/${id}/documents`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </Link>
            </div>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Document list</h2>
              <p className="mt-1 text-sm text-slate-600">
                {filteredRows.length} {filteredRows.length === 1 ? "item" : "items"} shown
              </p>
            </div>

            {(query || selectedType || selectedStatus) && (
              <Link
                href={`/patients/${id}/documents${buildQueryString({})}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </Link>
            )}
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="text-base font-semibold text-slate-900">No files found</h3>
            <p className="mt-2 text-sm text-slate-600">
              There are no files for {patientName} matching the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {row.ownerInitials}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{row.name}</div>
                          <div className="mt-1 text-xs text-slate-500">Encounter ID: {row.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">{row.type}</td>

                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                          getStatusClasses(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">{formatDate(row.updatedAt)}</td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/patients/${id}?encounter=${row.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </Link>
                        <button
                          aria-label={`More actions for ${row.name}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          •••
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}