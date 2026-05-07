"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface CredentialingTask {
  id: string;
  provider_id?: string | null;
  payer_id?: string | null;
  task_type?: string | null;
  status?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at?: string;
}

interface Provider {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  npi?: string | null;
}

interface Payer {
  id: string;
  payer_name?: string | null;
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

function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "blocked":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getPriorityColor(dueDate: string | null | undefined) {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  const today = new Date();
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "text-red-700 font-semibold"; // Overdue
  if (diffDays <= 7) return "text-orange-700 font-semibold"; // Due within 7 days
  return "";
}

export default function CredentialingTasksPage() {
  const [tasks, setTasks] = useState<(CredentialingTask & { provider?: Provider; payer?: Payer })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      setLoading(true);
      setError(null);

      const { data: tasksData, error: tasksError } = await supabase
        .from("credentialing_tasks")
        .select("*")
        .is("archived_at", null)
        .order("due_date", { ascending: true });

      if (!active) return;

      if (tasksError) {
        setError(tasksError.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      const tasks = (tasksData ?? []) as CredentialingTask[];
      const providerIds = Array.from(new Set(tasks.map((t) => t.provider_id).filter(Boolean) as string[]));
      const payerIds = Array.from(new Set(tasks.map((t) => t.payer_id).filter(Boolean) as string[]));

      const enrichedTasks = [...tasks];

      if (providerIds.length > 0) {
        const { data: providersData } = await supabase
          .from("providers")
          .select("id, first_name, last_name, npi")
          .in("id", providerIds);

        const providerById = new Map((providersData ?? []).map((p: Provider) => [p.id, p]));
        enrichedTasks.forEach((task) => {
          if (task.provider_id) {
            (task as any).provider = providerById.get(task.provider_id);
          }
        });
      }

      if (payerIds.length > 0) {
        const { data: payersData } = await supabase
          .from("insurance_payers")
          .select("id, payer_name")
          .in("id", payerIds);

        const payerById = new Map((payersData ?? []).map((p: Payer) => [p.id, p]));
        enrichedTasks.forEach((task) => {
          if (task.payer_id) {
            (task as any).payer = payerById.get(task.payer_id);
          }
        });
      }

      setTasks(enrichedTasks);
      setLoading(false);
    }

    void loadTasks();

    return () => {
      active = false;
    };
  }, []);

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const query = search.trim().toLowerCase();
    const providerName = [task.provider?.first_name, task.provider?.last_name].filter(Boolean).join(" ").toLowerCase();
    const payerName = (task.payer?.payer_name ?? "").toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      providerName.includes(query) ||
      payerName.includes(query) ||
      (task.task_type ?? "").toLowerCase().includes(query) ||
      (task.provider?.npi ?? "").toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Credentialing Tasks</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage provider credentialing and payer enrollment tasks.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              disabled
            >
              New Task
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading credentialing tasks...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Error loading tasks: {error}
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-5">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Total Tasks</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{statusCounts.all}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Pending</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-600">{statusCounts.pending}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">In Progress</div>
                  <div className="mt-2 text-2xl font-semibold text-blue-600">{statusCounts.in_progress}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Completed</div>
                  <div className="mt-2 text-2xl font-semibold text-green-600">{statusCounts.completed}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Blocked</div>
                  <div className="mt-2 text-2xl font-semibold text-red-600">{statusCounts.blocked}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["all", "pending", "in_progress", "completed", "blocked"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={[
                          "rounded-lg px-3 py-2 text-sm capitalize",
                          statusFilter === status
                            ? "bg-blue-50 text-blue-700"
                            : "border border-gray-300 text-gray-700 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Search providers, payers, task types..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Provider</th>
                        <th className="px-4 py-3">Payer</th>
                        <th className="px-4 py-3">Task Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3">Completed</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTasks.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                            {search || statusFilter !== "all"
                              ? "No tasks match your filters."
                              : "No credentialing tasks found."}
                          </td>
                        </tr>
                      ) : (
                        filteredTasks.map((task) => (
                          <tr key={task.id} className="text-sm text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {task.provider ? (
                                <div>
                                  <div>
                                    {[task.provider.first_name, task.provider.last_name].filter(Boolean).join(" ")}
                                  </div>
                                  {task.provider.npi && (
                                    <div className="text-xs text-gray-500">NPI: {task.provider.npi}</div>
                                  )}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">{task.payer?.payer_name || "—"}</td>
                            <td className="px-4 py-3 capitalize">{task.task_type?.replace(/_/g, " ") || "—"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                                  task.status
                                )}`}
                              >
                                {task.status?.replace("_", " ") || "—"}
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${getPriorityColor(task.due_date)}`}>
                              {formatDate(task.due_date)}
                            </td>
                            <td className="px-4 py-3">{formatDate(task.completed_at)}</td>
                            <td className="px-4 py-3">
                              <div className="max-w-xs truncate" title={task.notes || ""}>
                                {task.notes || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button className="text-blue-600 hover:underline" disabled>
                                Edit
                              </button>
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
