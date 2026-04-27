// File: app/billing/workqueue/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { SupportTicketRecord, WorkqueueItemRecord } from "@/lib/types";

type QueueStatusFilter = "all" | "open" | "in_progress" | "blocked" | "resolved" | "closed";

interface WorkqueueRow extends WorkqueueItemRecord {
  support_ticket?: SupportTicketRecord | null;
}

function matchesStatus(item: WorkqueueRow, filter: QueueStatusFilter) {
  if (filter === "all") return true;
  return (item.status ?? "") === filter;
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

export default function BillingWorkqueuePage() {
  const [items, setItems] = useState<WorkqueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: workqueueData, error: workqueueError } = await supabase
        .from("workqueue_items")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (workqueueError) {
        setError(workqueueError.message);
        setItems([]);
        setLoading(false);
        return;
      }

      const rows = (workqueueData ?? []) as WorkqueueItemRecord[];
      const workqueueIds = rows.map((row) => row.id);

      let ticketsByWorkqueueId = new Map<string, SupportTicketRecord>();

      if (workqueueIds.length > 0) {
        const { data: ticketData, error: ticketError } = await supabase
          .from("support_tickets")
          .select("*")
          .in("workqueue_item_id", workqueueIds)
          .is("archived_at", null);

        if (!active) return;

        if (ticketError) {
          setError(ticketError.message);
          setItems([]);
          setLoading(false);
          return;
        }

        ticketsByWorkqueueId = new Map(
          ((ticketData ?? []) as SupportTicketRecord[])
            .filter((ticket) => ticket.workqueue_item_id)
            .map((ticket) => [ticket.workqueue_item_id as string, ticket])
        );
      }

      const merged = rows.map((row) => ({
        ...row,
        support_ticket: ticketsByWorkqueueId.get(row.id) ?? null,
      }));

      setItems(merged);
      setLoading(false);
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const ticket = item.support_ticket;
      const matchesQuery =
        query.length === 0 ||
        item.id.toLowerCase().includes(query) ||
        (item.title ?? "").toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.work_type ?? "").toLowerCase().includes(query) ||
        (item.status ?? "").toLowerCase().includes(query) ||
        (ticket?.title ?? "").toLowerCase().includes(query) ||
        (ticket?.category ?? "").toLowerCase().includes(query) ||
        (item.client_id ?? "").toLowerCase().includes(query) ||
        (item.claim_id ?? "").toLowerCase().includes(query) ||
        (item.encounter_id ?? "").toLowerCase().includes(query);

      return matchesQuery && matchesStatus(item, statusFilter);
    });
  }, [items, search, statusFilter]);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Billing Work Queue</h1>
            <p className="mt-2 text-sm text-gray-600">
              Live queue data from workqueue_items and linked support_tickets.
            </p>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <div>
              <div className="text-sm text-gray-500">Total loaded</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{items.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Filtered</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">{filteredItems.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Open</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {items.filter((item) => item.status === "open").length}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">In progress</div>
              <div className="mt-1 text-2xl font-semibold text-gray-900">
                {items.filter((item) => item.status === "in_progress").length}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px]">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, status, work type, client, claim, encounter, or ticket"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as QueueStatusFilter)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
              Loading work queue...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
              Could not load work queue: {error}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Work type</th>
                      <th className="px-4 py-3">Queue title</th>
                      <th className="px-4 py-3">Ticket title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Claim</th>
                      <th className="px-4 py-3">Encounter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-500">
                          No work queue items found.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(item.created_at)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {item.status ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">{item.priority ?? "—"}</td>
                          <td className="px-4 py-3">{item.work_type ?? "—"}</td>
                          <td className="px-4 py-3">{item.title ?? "—"}</td>
                          <td className="px-4 py-3">{item.support_ticket?.title ?? "—"}</td>
                          <td className="px-4 py-3">{item.support_ticket?.category ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.client_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.claim_id ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs">{item.encounter_id ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
