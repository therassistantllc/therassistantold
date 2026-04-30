"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";

interface SupportTicketRecord {
  id: string;
  category?: string | null;
  status?: string | null;
  priority?: string | null;
  title?: string | null;
  description?: string | null;
  source_object_type?: string | null;
  source_object_id?: string | null;
  assigned_to_user_id?: string | null;
  workqueue_item_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
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

function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getPriorityColor(priority: string | null | undefined) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("support_tickets")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message);
        setTickets([]);
        setLoading(false);
        return;
      }

      setTickets((data ?? []) as SupportTicketRecord[]);
      setLoading(false);
    }

    void loadTickets();

    return () => {
      active = false;
    };
  }, []);

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      (ticket.title ?? "").toLowerCase().includes(query) ||
      (ticket.description ?? "").toLowerCase().includes(query) ||
      (ticket.category ?? "").toLowerCase().includes(query) ||
      ticket.id.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage support tickets, billing issues, and workflow items.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading tickets...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Error loading tickets: {error}
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">{statusCounts.all}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Open</div>
                  <div className="mt-2 text-2xl font-semibold text-blue-600">{statusCounts.open}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">In Progress</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-600">{statusCounts.in_progress}</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-sm text-gray-500">Resolved</div>
                  <div className="mt-2 text-2xl font-semibold text-green-600">{statusCounts.resolved}</div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(["all", "open", "in_progress", "resolved"] as const).map((status) => (
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
                    placeholder="Search tickets..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Source</th>
                        <th className="px-4 py-3">Created</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                            {search || statusFilter !== "all" ? "No tickets match your filters." : "No tickets found."}
                          </td>
                        </tr>
                      ) : (
                        filteredTickets.map((ticket) => (
                          <tr key={ticket.id} className="text-sm text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{ticket.title || "—"}</div>
                              {ticket.description && (
                                <div className="mt-1 text-xs text-gray-500 line-clamp-1">{ticket.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">{ticket.category || "—"}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                                  ticket.status
                                )}`}
                              >
                                {ticket.status?.replace("_", " ") || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getPriorityColor(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {ticket.source_object_type && ticket.source_object_id ? (
                                <Link
                                  href={`/${ticket.source_object_type}s/${ticket.source_object_id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {ticket.source_object_type}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3">{formatDateTime(ticket.created_at)}</td>
                            <td className="px-4 py-3">
                              <button className="text-blue-600 hover:underline">View</button>
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
