// File: app/patients/[id]/documents/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { EncounterRecord } from "@/lib/types";

interface DocumentItem {
  id: string;
  documentType: string;
  dateOfService: string | null;
  status: "Draft" | "Signed";
  author: string;
  updatedAt: string | null;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function PatientDocumentsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
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
        .from("encounters")
        .select("*")
        .eq("client_id", patientId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setEncounters((data ?? []) as EncounterRecord[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [patientId]);

  const documents = useMemo<DocumentItem[]>(() => {
    return encounters.map((encounter) => ({
      id: encounter.id,
      documentType: "Encounter Note",
      dateOfService: encounter.service_date ?? null,
      status: (encounter.encounter_status ?? "").toLowerCase() === "completed" ? "Signed" : "Draft",
      author: encounter.provider_id ?? "Provider",
      updatedAt: encounter.updated_at ?? encounter.created_at ?? null,
    }));
  }, [encounters]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
            <p className="mt-2 text-sm text-gray-600">
              Clinical notes, signed documents, uploaded files, and draft notes live here as the legal medical record.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/patients/${patientId}`} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm hover:bg-gray-50">
              Back to Profile
            </Link>
            <Link href={`/patients/${patientId}`} className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">
              Create Note
            </Link>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Loading documents...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          Could not load documents: {error}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
          <div className="text-lg font-semibold text-gray-900">No documents yet</div>
          <div className="mt-2 text-sm text-gray-600">Draft notes and signed notes will appear here in chronological order.</div>
        </div>
      ) : (
        <section className="rounded-2xl border border-gray-200 bg-white p-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">Date of Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Author</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="text-sm text-gray-700">
                    <td className="px-4 py-3">{doc.documentType}</td>
                    <td className="px-4 py-3">{doc.dateOfService ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={doc.status === "Signed" ? "rounded-full bg-green-100 px-2 py-1 text-xs text-green-800" : "rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800"}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{doc.author}</td>
                    <td className="px-4 py-3">{formatDateTime(doc.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
