// File: app/billing/route-to-biller/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase/client";
import type { SupportTicketRecord, WorkqueueItemRecord } from "@/lib/types";

interface RouteRow extends SupportTicketRecord {
  workqueue?: WorkqueueItemRecord | null;
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

export default function RouteToBillerQueuePage() {
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      if (ticketError) {
        setError(ticketError.message);
        setLoading(false);
        return;
      }

      const tickets = ((ticketData ?? []) as SupportTicketRecord[]).filter((ticket) => {
        const text = `${ticket.category ?? ""} ${ticket.title ?? ""} ${ticket.description ?? ""}`.toLowerCase();
        return text.includes("biller") || text.includes("billing");
      });

      const workqueueIds = tickets.map((item) => item.workqueue_item_id).filter(Boolean) as string[];

      let workqueueById = new Map<string, WorkqueueItemRecord>();
      if (workqueueIds.length > 0) {
        const { data: workqueueData, error: workqueueError } = await supabase
          .from("workqueue_items")
          .select("*")
          .in("id", workqueueIds)
          .is("archived_at", null);

        if (!active) return;
        if (workqueueError) {
          setError(workqueueError.message);
          setLoading(false);
          return;
        }

        workqueueById = new Map(((workqueueData ?? []) as WorkqueueItemRecord[]).map((item) => [item.id, item]));
      }

      setRows(tickets.map((ticket) => ({
        ...ticket,
        workqueue: ticket.workqueue_item_id ? workqueueById.get(ticket.workqueue_item_id) ?? null : null,
      })));
      setLoading(false);
    }

    void loadQueue();

    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Route to Biller Queue</h1>
            <p className="mt-2 text-sm text-gray-600">Escalations and chart-originated tickets routed to billing.</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">Loading Route to Biller queue...</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">Could not load Route to Biller queue: {error}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Queue title</th>
                      <th className="px-4 py-3">Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No billing-route tickets found.</td></tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="text-sm text-gray-700">
                          <td className="px-4 py-3">{formatDateTime(row.created_at)}</td>
                          <td className="px-4 py-3">{row.title ?? "—"}</td>
                          <td className="px-4 py-3">{row.category ?? "—"}</td>
                          <td className="px-4 py-3">{row.status ?? "—"}</td>
                          <td className="px-4 py-3">{row.workqueue?.title ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href="/billing/workqueue" className="text-blue-700 hover:underline">Work Queue</Link>
                              {row.workqueue?.claim_id ? <Link href={`/claims/${row.workqueue.claim_id}`} className="text-blue-700 hover:underline">Claim</Link> : null}
                              {row.workqueue?.encounter_id ? <Link href="/encounters" className="text-blue-700 hover:underline">Encounter</Link> : null}
                            </div>
                          </td>
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
