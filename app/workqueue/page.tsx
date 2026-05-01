// File: app/workqueue/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface WorkqueueItem {
  id: string;
  organization_id?: string | null;
  queue_type?: string | null;
  work_type?: string | null;
  status?: string | null;
  priority?: string | null;
  title?: string | null;
  description?: string | null;
  client_id?: string | null;
  claim_id?: string | null;
  encounter_id?: string | null;
  appointment_id?: string | null;
  created_at?: string | null;
}

type QueueType = "all" | "eligibility_needed" | "ready_to_bill" | "ready_to_submit" | "no_response" | "rejected" | "era_missing";

function priorityColor(priority: string | null | undefined) {
  if (priority === "urgent") return "bg-red-100 text-red-800 border-red-200";
  if (priority === "high") return "bg-orange-100 text-orange-800 border-orange-200";
  if (priority === "normal") return "bg-blue-100 text-blue-800 border-blue-200";
  if (priority === "low") return "bg-gray-100 text-gray-800 border-gray-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function statusColor(status: string | null | undefined) {
  if (status === "completed") return "bg-green-100 text-green-800 border-green-200";
  if (status === "in_progress") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "open") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "deferred") return "bg-gray-100 text-gray-800 border-gray-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function WorkQueuePage() {
  const searchParams = useSearchParams();
  const initialQueue = (searchParams?.get("queue") as QueueType) || "all";

  const [items, setItems] = useState<WorkqueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueType>(initialQueue);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [autoGenerating, setAutoGenerating] = useState(false);

  async function loadWorkqueue() {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("workqueue_items")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (queueFilter !== "all") {
      query = query.eq("queue_type", queueFilter);
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as WorkqueueItem[]);
    setLoading(false);
  }

  async function handleAutoGenerate() {
    setAutoGenerating(true);

    try {
      const response = await fetch("/api/workqueue/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: items[0]?.organization_id || "00000000-0000-0000-0000-000000000000",
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Auto-generated ${result.itemsCreated} workqueue items`);
        await loadWorkqueue();
      } else {
        alert(`Failed to auto-generate: ${result.error}`);
      }
    } catch (error) {
      alert("Network error during auto-generate");
    } finally {
      setAutoGenerating(false);
    }
  }

  useEffect(() => {
    void loadWorkqueue();
  }, [queueFilter, statusFilter]);

  const queueCounts = {
    all: items.length,
    eligibility_needed: items.filter((i) => i.queue_type === "eligibility_needed").length,
    ready_to_bill: items.filter((i) => i.queue_type === "ready_to_bill").length,
    ready_to_submit: items.filter((i) => i.queue_type === "ready_to_submit").length,
    no_response: items.filter((i) => i.queue_type === "no_response").length,
    rejected: items.filter((i) => i.queue_type === "rejected").length,
    era_missing: items.filter((i) => i.queue_type === "era_missing").length,
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Work Queue</h1>
              <p className="mt-2 text-sm text-gray-600">
                Auto-generated work items from scheduling, encounters, and claims.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void loadWorkqueue()}
                disabled={loading}
                className="rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh
              </button>
              <button
                onClick={() => void handleAutoGenerate()}
                disabled={autoGenerating}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {autoGenerating ? "Generating..." : "Auto-Generate Queue"}
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            {(
              [
                { key: "all", label: "All" },
                { key: "eligibility_needed", label: "Eligibility Missing" },
                { key: "ready_to_bill", label: "Ready to Bill" },
                { key: "ready_to_submit", label: "Ready to Submit" },
                { key: "no_response", label: "No Response" },
                { key: "rejected", label: "Rejected" },
                { key: "era_missing", label: "ERA Missing" },
              ] as const
            ).map((queue) => (
              <button
                key={queue.key}
                onClick={() => setQueueFilter(queue.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  queueFilter === queue.key
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {queue.label} ({queueCounts[queue.key]})
              </button>
            ))}
          </div>

          <div className="mb-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="deferred">Deferred</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading workqueue...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
              <div className="text-lg font-semibold text-gray-900">No work items</div>
              <p className="mt-2 text-sm text-gray-600">
                Click "Auto-Generate Queue" to populate work items from appointments, encounters, and claims.
              </p>
              <button
                onClick={() => void handleAutoGenerate()}
                disabled={autoGenerating}
                className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {autoGenerating ? "Generating..." : "Auto-Generate Queue"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-gray-900">{item.title || "Untitled"}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${priorityColor(item.priority)}`}>
                          {item.priority || "normal"}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusColor(item.status)}`}>
                          {item.status || "open"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-gray-700">{item.description || "No description"}</p>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Queue:</span> {item.queue_type || "—"}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {item.work_type || "—"}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span> {formatDateTime(item.created_at)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.client_id && (
                          <Link href={`/patients/${item.client_id}`} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
                            View Patient
                          </Link>
                        )}
                        {item.appointment_id && (
                          <Link href={`/scheduling?appointmentId=${item.appointment_id}`} className="rounded-md bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">
                            View Appointment
                          </Link>
                        )}
                        {item.encounter_id && (
                          <Link href={`/encounters/${item.encounter_id}`} className="rounded-md bg-purple-50 px-2 py-1 text-xs text-purple-700 hover:bg-purple-100">
                            View Encounter
                          </Link>
                        )}
                        {item.claim_id && (
                          <Link href={`/claims/${item.claim_id}`} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 hover:bg-amber-100">
                            View Claim
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
